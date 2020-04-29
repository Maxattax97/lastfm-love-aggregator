const _ = require('lodash');
const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const LastFM = require('./lib/LastFM');
const AcoustID = require('./lib/AcoustID');
const CoverArtArchive = require('./lib/CoverArtArchive');
const Youtube = require('./lib/Youtube');
const Media = require('./lib/Media');
const Logger = require('./lib/Logger');
const configuration = require('./api-keys.json');

const init = async () => {
  const lfm = new LastFM({
    apiKey: configuration.apiKey,
    sharedSecret: configuration.sharedSecret,
  });
  const aid = new AcoustID({
    apiKey: configuration.acoustidApiKey,
  });
  const caa = new CoverArtArchive();
  const yt = new Youtube();

  const user = 'Maxattax97';

  Logger.info(`Retrieving LastFM loved tracks for ${user} ...`);
  const lovedResponse = await lfm.userGetLovedTracks({
    user,
    limit: 10,
  });

  // console.log(util.inspect(lovedResponse, { depth: null }));

  const loved = LastFM.parseTracks(lovedResponse.lovedtracks.track);
  Logger.info('Loved songs: %o', loved);

  Logger.info('Scraping loved tracks for Youtube URLs ...');
  const ytScrape = await Promise.all(_.map([loved[9]], (track) => lfm.scrapeSong(track)));

  Logger.info('Youtube URLs: %o', ytScrape);

  Logger.info('Streaming audio from Youtube ...');
  const audioDownload = await yt.download({
    url: ytScrape[0].youtubeUrl,
    filename: `${ytScrape[0].artist} - ${ytScrape[0].title}`,
    // url: 'https://youtu.be/AqqaavQzPtI',
  });
  Logger.info('Audio download: %o', audioDownload);

  Logger.info('Searching AcoustID for fingerprint ...');
  const response = await aid.lookup({
    // file: './samples/Ongoing Thing (feat. Oddisee).mp3'
    // file: './samples/NEW DAWN.mp3'
    // file: './samples/New Order (feat. Holybrune).mp3'
    // file: './samples/01 Intro.mp3',
    file: audioDownload.path,
  });

  let track = null;
  if (response.results.length > 0) {
    Logger.info('Entry found: %o', response);
    // console.log(util.inspect(response, { depth: null }));

    Logger.info('Found track, fetching cover art ...');
    track = AcoustID.parseTrack(response);

    try {
      const coverArt = await caa.getFront({
        releaseId: track.mbid,
      });
      track.cover = coverArt.path;
    } catch (err) {
      Logger.warn(`Could not find cover art for ${track.mbid} `, err);
    }

    track.comment = track.mbid;
  }

  // Fill in whatever is missing with the youtube metadata.
  track = _.defaults(track, {
    title: ytScrape[0].title,
    artist: ytScrape[0].artist,
    cover: audioDownload.thumbnailPath,
    comment: ytScrape[0].mbid, // Tag the mbid so we can check it later for syncing purposes..
  });

  Logger.info('Finalized track: %o', track);
  await Media.setMetadata(_.defaults(track, {
    file: audioDownload.path,
    attachments: track.cover,
  }));

  const restingPlace = path.join(__dirname, `${track.artist} - ${track.title}.mp3`);
  await fs.move(audioDownload.path, restingPlace, {
    overwrite: true,
  });
  Logger.info(`Song relocated to ${restingPlace} with updated metadata`);
};

init();
