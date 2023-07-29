/* eslint-env jest */

// import { jest } from '@jest/globals';
import fs from 'fs-extra';
import Youtube from './Youtube.js';

describe('Youtube', () => {
  let yt = null;
  beforeAll(async () => {
    yt = new Youtube();
  });

  afterAll(async () => {
    await yt.cleanup();
  });

  it(
    'should download audio from a URL',
    async () => {
      const audioDownload = await yt.download({
        url: 'https://www.youtube.com/watch?v=Ir7UmJ_foHs',
        filename: 'brent_rambo',
      });

      await fs.access(audioDownload.path);
      await fs.access(audioDownload.thumbnailPath);
    },
    30 * 1000,
  );
});
