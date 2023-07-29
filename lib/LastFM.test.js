/* eslint-env jest */

import fs from 'fs-extra';
// import { jest } from '@jest/globals';
import _ from 'lodash';
import LastFM from './LastFM.js';

describe('LastFM', () => {
  let lfm = null;
  let hasApiKey = false;

  beforeAll(async () => {
    let configuration = {};
    try {
      configuration = JSON.parse(
        (await fs.readFile('./api-keys.json')).toString(),
      );
      hasApiKey = true;
    } catch (err) {
      console.log('no API key provided, skipping those tests');
      configuration.apiKey = 'REDACTED';
      configuration.sharedSecret = 'REDACTED';
    }

    lfm = new LastFM({
      apiKey: configuration.apiKey,
      sharedSecret: configuration.sharedSecret,
    });
  });

  it('should get and parse loved LastFM tracks', async () => {
    if (!hasApiKey) {
      console.log('Skipping this test because no API key was provided');
      return;
    }

    const lovedResponse = await lfm.userGetLovedTracks({
      user: 'Maxattax97',
      limit: 5,
    });

    const loved = LastFM.parseTracks(lovedResponse.lovedtracks.track);
    expect(loved.length).toEqual(5);

    const firstTrack = loved[0];
    expect(typeof firstTrack.title).toBe('string');
    expect(typeof firstTrack.mbid).toBe('string');
    expect(typeof firstTrack.artist).toBe('string');
    expect(typeof firstTrack.artistMbid).toBe('string');
    expect(_.startsWith(firstTrack.url, 'https://www.last.fm/music/')).toBe(
      true,
    );
  });

  it('should scrape [YOUR NAME by DVRST]', async () => {
    const demoTrack = {
      title: 'YOUR NAME',
      artist: 'DVRST',
      artistMbid: 'b04b7c24-59d2-47f8-8ca8-bcf6f6d106ed',
      url: 'https://www.last.fm/music/DVRST/_/YOUR+NAME',
      mbid: '750ee163-e687-445e-a62b-10cf2f75dd83',
    };

    const ytScrape = await lfm.scrapeSong(demoTrack);

    expect(ytScrape).toMatchSnapshot();
  });
});
