const _ = require('lodash');
const got = require('got');
const { default: PQueue } = require('p-queue');
const tempy = require('tempy');
const fs = require('fs-extra');
const del = require('del');
const path = require('path');

// https://musicbrainz.org/doc/Cover_Art_Archive/API
class CoverArtArchive {
  constructor(param) {
    const opt = _.defaultsDeep(param, {
      root: 'https://coverartarchive.org',
      storage: tempy.directory(),
    });

    this.root = opt.root;
    this.storage = opt.storage;

    this.apiQueue = new PQueue({
      intervalCap: 2,
      interval: 1000,
    });
  }

  async cleanup() {
    return del(this.storage, { force: true });
  }

  async apiRequest(param) {
    const opt = _.defaultsDeep(param, {
      path: null,
    });

    return this.apiQueue.add(() => got(`${this.root}${opt.path}`).buffer());
  }

  async getFront(param) {
    const opt = _.defaultsDeep(param, {
      releaseId: null,
    });

    if (!opt.releaseId) {
      throw new Error('You must have a Release ID to query cover art');
    }

    // This will redirect directly to the image buffer.
    const buffer = await this.apiRequest({
      path: `/release/${opt.releaseId}/front`,
    });

    const destination = path.join(this.storage, opt.releaseId);
    await fs.writeFile(destination, buffer);

    return {
      path: destination,
    };
  }
}

module.exports = CoverArtArchive;
