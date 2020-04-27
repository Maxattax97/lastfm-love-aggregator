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

  const response = await aid.lookup({
    // file: './samples/Ongoing Thing (feat. Oddisee).mp3'
    // file: './samples/NEW DAWN.mp3'
    // file: './samples/New Order (feat. Holybrune).mp3'
    file: './samples/01 Intro.mp3',
  });
  console.log(util.inspect(response, { depth: null }));

  console.log(aid.parseTrack(response));

  console.log(await caa.getFront({
    releaseId: response.mbid,
  }));

  // const response = await lfm.userGetLovedTracks({
  // user: 'Maxattax97',
  // limit: 10
  // });

  // Logger.info(response);
  // Logger.info(response.lovedtracks.track);
  // const parsed = lfm.parseTracks(response.lovedtracks.track);
  // Logger.info(parsed);

  // Logger.info('Scraping for Youtube URLs');
  // const scraped = await Promise.all(_.map(parsed, (track) => {
  // return lfm.scrapeSong(track);
  // }));

  // Logger.info(scraped);
};

init();
