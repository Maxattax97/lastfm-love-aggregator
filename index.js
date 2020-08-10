const _ = require('lodash');
const path = require('path');
const fs = require('fs-extra');
const { argv } = require('yargs')
  .usage('Usage: $0 [options]')
  .example('$0 -u Maxattax97 -o ./music -c 4', 'Downloads loved music for Maxattax97 to the local music/ folder with 4 threads of concurrency')
  .alias('u', 'username')
  .nargs('u', 1)
  .describe('u', 'The user we are interested in collecting loved songs from')
  .string('u') // We parse this path ourselves (might have wildcards).
  .demandOption('u')
  .alias('o', 'output')
  .nargs('o', 1)
  .describe('o', 'Output path representing your library to synchronize music to')
  .normalize('o') // Normalizes to a path.
  .alias('c', 'concurrency')
  .nargs('c', 1)
  .describe('c', 'How many threads youtube-dl is allowed to take up for converting codecs, default is (CPU threads - 1)')
  .help('h')
  .alias('h', 'help');
const LastFM = require('./lib/LastFM');
const AcoustID = require('./lib/AcoustID');
const CoverArtArchive = require('./lib/CoverArtArchive');
const Youtube = require('./lib/Youtube');
const MusicBrainz = require('./lib/MusicBrainz');
const Media = require('./lib/Media');
const Logger = require('./lib/Logger');
const configuration = require('./api-keys.json');
const pkg = require('./package.json');

const USER_AGENT = `lastfm-love-aggregator/${pkg.version} ( https://github.com/Maxattax97/lastfm-love-aggregator )`;

// .default(argsDefault)

const init = async () => {
  const lfm = new LastFM({
    apiKey: configuration.apiKey,
    sharedSecret: configuration.sharedSecret,
  });
  const aid = new AcoustID({
    apiKey: configuration.acoustidApiKey,
  });
  const caa = new CoverArtArchive();
  const yt = new Youtube({
    threads: argv.threads,
  });
  const mb = new MusicBrainz({
    userAgent: USER_AGENT,
    retryOn: true,
  });

  const user = _.defaultTo(argv.username, 'Maxattax97');
  const storagePath = _.defaultTo(argv.output, path.join(__dirname, 'music'));
  Logger.info(`Creating directory: ${storagePath} ...`);
  await fs.ensureDir(storagePath);

  // TODO: Check the local files before you download them.
  Logger.info('Scanning directory metadata ...');
  const scanResult = await Media.scanDirectory({
    directory: storagePath,
  });
  Logger.debug('Scan complete: %o', scanResult);

  Logger.info(`Retrieving LastFM loved tracks for ${user} ...`);
  try {
    const lovedResponse = await lfm.userGetLovedTracks({
      user,
      limit: 10,
    });

    const loved = LastFM.parseTracks(lovedResponse.lovedtracks.track);
    Logger.debug('Loved songs: %o', loved);

    const queue = [];

    _.each(loved, (lovedTrack) => {
      const asyncId = _.defaultTo(lovedTrack.mbid, lovedTrack.title);
      queue.push((async () => {
        try {
          const match = _.find(scanResult, (track) => track.Comment === lovedTrack.mbid || (track.title === lovedTrack.title && track.artist === lovedTrack.artist));
          if (match) {
            Logger.info(`${lovedTrack.title} by ${lovedTrack.artist} already exists in the library, skipping ...`);
            Logger.debug(`[${asyncId}] This track already exists in the library, skipping: %o`, match);
            // TODO: Stop paging after a match.
            return;
          }

          const ytScrape = await lfm.scrapeSong(lovedTrack);
          Logger.debug(`[${asyncId}] Youtube URL: %o`, ytScrape);

          try {
            Logger.info(`Downloading audio for ${lovedTrack.title} by ${lovedTrack.artist} ...`);
            const audioDownload = await yt.download({
              url: ytScrape.youtubeUrl,
              filename: `${ytScrape.artist} - ${ytScrape.title}`,
            });
            Logger.debug(`[${asyncId}] Audio download: %o`, audioDownload);

            let track = null;
            let response = null;
            try {
              response = await aid.lookup({
                file: audioDownload.path,
              });
            } catch (errAcoustic) {
              Logger.warn(`[${asyncId}] Failed to find an AcousticID match: %o`, errAcoustic);
            }

            if (response && response.results.length > 0) {
              Logger.info(`An AcousticID entry was found for ${lovedTrack.title} by ${lovedTrack.artist}`);
              Logger.debug(`[${asyncId}] Entry found: %o`, response);
              track = AcoustID.parseTrack(response);
            } else {
              let mbRelease = null;
              mbRelease = await mb.track({
                mbid: lovedTrack.mbid,
              });
              Logger.info(`A MusicBrainz entry was found for ${lovedTrack.title} by ${lovedTrack.artist}`);

              track = MusicBrainz.parseTrack({
                trackId: lovedTrack.mbid,
                apiResponse: mbRelease,
              });
            }

            try {
              const coverArt = await caa.getFront({
                releaseId: track.releaseId,
              });
              track.cover = coverArt.path;
              Logger.info(`A cover art was found for ${lovedTrack.title} by ${lovedTrack.artist}`);
            } catch (errCoverArt) {
              if (errCoverArt.message.indexOf('NOT FOUND') >= 0) {
                // noop.
              } else {
                Logger.warn(`[${asyncId}] Could not find cover art for ${track.releaseId}:`, errCoverArt.message);
              }
            }

            track.comment = track.mbid;

            // Fill in whatever is missing with the youtube metadata.
            track = _.defaultsDeep(track, {
              title: ytScrape.title,
              artist: ytScrape.artist,
              cover: audioDownload.thumbnailPath,
              comment: ytScrape.mbid, // Tag the mbid so we can check it later for syncing purposes..
            });

            Logger.debug(`[${asyncId}] Finalized track: %o`, track);
            await Media.setMetadata(_.defaults(track, {
              file: audioDownload.path,
              attachments: track.cover,
            }));

            // TODO: Organize into folders.
            const restingPlace = path.join(storagePath, `${track.artist} - ${track.title}.mp3`);
            await fs.move(audioDownload.path, restingPlace, {
              overwrite: true,
            });
            Logger.info(`${lovedTrack.title} by ${lovedTrack.artist} relocated to ${restingPlace} with updated metadata`);
          } catch (errYtDl) {
            Logger.error(`[${asyncId}] Failed to download audio from ${ytScrape.youtubeUrl}: `, errYtDl);
          }
        } catch (errYtScrape) {
          Logger.error(`[${asyncId}] Failed to scrape Youtube URL's from LastFM: `, errYtScrape.message);
        }
      })());
    });

    await Promise.all(queue);
    Logger.info('All jobs done, your library has been synchronized');
  } catch (errLastFM) {
    Logger.error('Failed to read loved songs from LastFM: %o', errLastFM);
  }
};

init();
