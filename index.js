const _ = require('lodash');
const LastFM = require('./lib/LastFM.js');
const AcoustID = require('./lib/AcoustID.js');
const Logger = require('./lib/Logger.js');
const configuration = require('./api-keys.json');

const init = async() => {
    const lfm = new LastFM({
        apiKey: configuration.apiKey,
        sharedSecret: configuration.sharedSecret,
    });

    const aid = new AcoustID({
        apiKey: configuration.acoustidApiKey,
    });

    const response = await aid.lookup();
    console.log(response);

    //const response = await lfm.userGetLovedTracks({
        //user: 'Maxattax97',
        //limit: 10
    //});

    //Logger.info(response);
    //Logger.info(response.lovedtracks.track);
    //const parsed = lfm.parseTracks(response.lovedtracks.track);
    //Logger.info(parsed);

    //Logger.info('Scraping for Youtube URLs');
    //const scraped = await Promise.all(_.map(parsed, (track) => {
        //return lfm.scrapeSong(track);
    //}));

    //Logger.info(scraped);    
};

init();
