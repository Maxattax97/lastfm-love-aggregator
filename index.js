#! /usr/bin/env node

import path from 'node:path';
import os from 'node:os';
import url from 'node:url';
import _ from 'lodash';
import fs from 'fs-extra';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import LastFM from './lib/LastFM.js';
import AcoustID from './lib/AcoustID.js';
import CoverArtArchive from './lib/CoverArtArchive.js';
import Youtube from './lib/Youtube.js';
import MusicBrainz from './lib/MusicBrainz.js';
import Media from './lib/Media.js';
import Logger from './lib/Logger.js';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .example(
    '$0 -u Maxattax97 -l 10 -k 1 -o ~/Music -c 4',
    "Downloads the 10 most recently loved songs, one at a time for Maxattax97 to home's Music folder with 4 threads of concurrency",
  )
  .alias('u', 'username')
  .nargs('u', 1)
  .describe('u', 'The user we are interested in collecting loved songs from')
  .string('u') // We parse this path ourselves (might have wildcards).
  .demandOption('u')
  .alias('o', 'output')
  .nargs('o', 1)
  .describe(
    'o',
    'Output path representing your library to synchronize music to',
  )
  .normalize('o') // Normalizes to a path.
  .default('o', './music/')
  .alias('c', 'concurrency')
  .nargs('c', 1)
  .number('c')
  .describe(
    'c',
    'How many threads youtube-dl is allowed to take up for converting codecs',
  )
  .default('c', os.cpus().length - 1) // This is threads, not cores. Drop one so we don't bog down the whole system.
  .alias('l', 'limit')
  .nargs('l', 1)
  .number('l')
  .describe('l', 'How deep to dive into the LastFM loved list')
  .default('l', Infinity)
  .alias('k', 'chunk')
  .nargs('k', 1)
  .number('k')
  .describe(
    'k',
    'How many songs should be fetched at a time from LastFM (uses pagination)',
  )
  .default('k', 10)
  .help('h')
  .alias('h', 'help')
  .parse();

const init = async () => {
  const configuration = JSON.parse(
    (await fs.readFile('./api-keys.json')).toString(),
  );

  const pkg = JSON.parse((await fs.readFile('./package.json')).toString());
  const USER_AGENT = `lastfm-love-aggregator/${pkg.version} ( https://github.com/Maxattax97/lastfm-love-aggregator )`;

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
  const storagePath = _.defaultTo(
    argv.output,
    path.join(url.fileURLToPath(import.meta.url), 'music'),
  );
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
      limit: argv.chunk,
    });

    const loved = LastFM.parseTracks(lovedResponse.lovedtracks.track);
    Logger.debug('Loved songs: %o', loved);

    const queue = [];

    _.each(loved, (lovedTrack) => {
      const asyncId = `[${_.defaultTo(
        lovedTrack.title,
        'Untitled',
      )} by ${_.defaultTo(lovedTrack.artist, 'Unknown')}]`;
      queue.push(
        (async () => {
          try {
            const match = _.find(
              scanResult,
              (track) => track.Comment === lovedTrack.mbid
                || track.Comment === lovedTrack.url
                || (track.title === lovedTrack.title
                  && track.artist === lovedTrack.artist),
            );
            if (match) {
              Logger.info(
                `${asyncId} already exists in the library, skipping ...`,
              );
              Logger.debug(
                `${asyncId} already exists in the library, skipping: %o`,
                match,
              );
              // TODO: Stop paging after a match.
              return;
            }

            const ytScrape = await lfm.scrapeSong(lovedTrack);
            Logger.debug(`${asyncId} Youtube URL: %o`, ytScrape);

            if (ytScrape.youtubeUrl) {
              try {
                Logger.info(`Downloading audio for ${asyncId} ...`);
                const audioDownload = await yt.download({
                  url: ytScrape.youtubeUrl,
                  filename: `${ytScrape.artist} - ${ytScrape.title}`
                    .replace(/[<>:"|?*/\\]/g, ' ')
                    .trim(),
                });
                Logger.debug(`${asyncId} Audio download: %o`, audioDownload);

                let track = null;
                let response = null;
                try {
                  response = await aid.lookup({
                    file: audioDownload.path,
                  });
                } catch (errAcoustic) {
                  Logger.warn(
                    `${asyncId} Failed to find an AcousticID match: %o`,
                    errAcoustic,
                  );
                }

                if (response && response.results.length > 0) {
                  Logger.info(`An AcousticID entry was found for ${asyncId}`);
                  Logger.debug(`${asyncId} Entry found: %o`, response);
                  track = AcoustID.parseTrack(response);
                } else {
                  let mbRelease = null;
                  try {
                    mbRelease = await mb.track({
                      mbid: lovedTrack.mbid,
                    });
                    Logger.info(`${asyncId} Found a MusicBrainz entry`);

                    track = MusicBrainz.parseTrack({
                      trackId: lovedTrack.mbid,
                      apiResponse: mbRelease,
                    });
                  } catch (errMusicBrainz) {
                    Logger.warn(
                      `${asyncId} Failed to find a MusicBrainz entry`,
                    );
                  }
                }

                if (track) {
                  try {
                    const coverArt = await caa.getFront({
                      releaseId: track.releaseId,
                    });
                    track.cover = coverArt.path;
                    Logger.info(`A cover art was found for ${asyncId}`);
                  } catch (errCoverArt) {
                    if (errCoverArt.message.indexOf('NOT FOUND') >= 0) {
                      // noop.
                    } else {
                      Logger.warn(
                        `${asyncId} Could not find cover art for ${track.releaseId}:`,
                        errCoverArt.message,
                      );
                    }
                  }
                }

                if (track) {
                  track.comment = track.mbid;
                } else {
                  track = {};
                }

                // Fill in whatever is missing with the youtube metadata.
                track = _.defaultsDeep(track, {
                  title: ytScrape.title,
                  artist: ytScrape.artist,
                  cover: audioDownload.thumbnailPath,
                  // Tag the mbid and LastFM URL so we can check it later for syncing purposes.
                  comment: lovedTrack.mbid ? lovedTrack.mbid : lovedTrack.url,
                });

                Logger.debug(`${asyncId} Finalized track: %o`, track);
                if (track.cover && track.cover.indexOf('.jpg') >= 0) {
                  Logger.debug(`${asyncId} Embedding cover with metadata ...`);
                  await Media.setMetadata(
                    _.defaults(track, {
                      file: audioDownload.path,
                      attachments: track.cover,
                    }),
                  );
                } else {
                  Logger.warn(
                    `${asyncId} Embedding only metadata ... this is due to a bug in the Youtube API and pending workaround in youtube-dl, see: https://github.com/ytdl-org/youtube-dl/issues/25687`,
                  );

                  await Media.setMetadata(
                    _.defaults(track, {
                      file: audioDownload.path,
                    }),
                  );
                }

                // TODO: Organize into folders with an CLI option.
                const artistTitleFilename = `${track.artist} - ${track.title}`
                  .replace(/[<>:"|?*/\\]/g, ' ')
                  .trim();
                const restingPlace = path.join(
                  storagePath,
                  `${artistTitleFilename}.mp3`,
                );
                await fs.move(audioDownload.path, restingPlace, {
                  overwrite: true,
                });
                Logger.info(
                  `Updated metadata for ${asyncId} and relocated to ${restingPlace}`,
                );
              } catch (errYtDl) {
                if (
                  errYtDl.message
                  && errYtDl.message.indexOf(
                    'No mimetype is known for stream 1',
                  ) >= 0
                ) {
                  Logger.warn(
                    `${asyncId} can't be downloaded at this time due to a bug in the Youtube API and pending workaround in youtube-dl, see: https://github.com/ytdl-org/youtube-dl/issues/25687`,
                  );
                } else if (
                  errYtDl.message
                  && errYtDl.message.indexOf('Bad Request') >= 0
                ) {
                  Logger.warn(
                    `Youtube is prohibitting download of ${asyncId} (reasons could include: age-locked, spam protection, DNS errors, or other issues) -- skipping...`,
                  );
                  Logger.debug(errYtDl);
                } else {
                  Logger.error(
                    `${asyncId} Failed to download audio from ${ytScrape.youtubeUrl}: `,
                    errYtDl,
                  );
                }
              }
            } else {
              Logger.warn(
                `${asyncId} has no linked YouTube video -- skipping ...`,
              );
            }
          } catch (errYtScrape) {
            Logger.error(
              `${asyncId} Failed to scrape Youtube URL's from LastFM: `,
              errYtScrape.message,
            );
          }
        })(),
      );
    });

    await Promise.all(queue);
    Logger.info('Cleaning up ...');
    await caa.cleanup();
    await yt.cleanup();
    Logger.info('All jobs done, your library has been synchronized');
  } catch (errLastFM) {
    Logger.error('Failed to read loved songs from LastFM: %o', errLastFM);
  }
};

init();
