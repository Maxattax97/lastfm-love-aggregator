const _ = require('lodash');
const util = require('util');
const LastFM = require('./lib/LastFM.js');
const AcoustID = require('./lib/AcoustID.js');
const CoverArtArchive = require('./lib/CoverArtArchive.js');
const Logger = require('./lib/Logger.js');
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

  const user = 'Maxattax97';

  Logger.info(`Retrieving LastFM loved tracks for ${user} ...`);
  const lovedResponse = await lfm.userGetLovedTracks({
    user,
    limit: 10,
  });

  const loved = LastFM.parseTracks(lovedResponse.lovedtracks.track);
  Logger.info('Loved songs: %o', loved);

  Logger.info('Scraping loved tracks for Youtube URLs ...');
  const ytScrape = await Promise.all(_.map([loved[0]], (track) => lfm.scrapeSong(track)));

  Logger.info('Youtube URLs: %o', ytScrape);

  // TODO: Download audio from Youtube.

  Logger.info('Searching AcoustID for fingerprint ...');
  const response = await aid.lookup({
    // file: './samples/Ongoing Thing (feat. Oddisee).mp3'
    // file: './samples/NEW DAWN.mp3'
    // file: './samples/New Order (feat. Holybrune).mp3'
    file: './samples/01 Intro.mp3',
  });
  Logger.info('Entry found: %o', response);
  // console.log(util.inspect(response, { depth: null }));

  Logger.info('Found track, fetching cover art ...');
  const track = AcoustID.parseTrack(response);

  track.cover = await caa.getFront({
    releaseId: response.mbid,
  });
  Logger.info('Finalized track: %o', track);
};

init();
