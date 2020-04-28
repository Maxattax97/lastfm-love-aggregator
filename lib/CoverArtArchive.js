const _ = require('lodash');
const got = require('got');
const { default: PQueue } = require('p-queue');

// https://musicbrainz.org/doc/Cover_Art_Archive/API
class CoverArtArchive {
  constructor(param) {
    const opt = _.defaultsDeep(param, {
      root: 'https://coverartarchive.org',
    });

    this.root = opt.root;

    this.apiQueue = new PQueue({
      intervalCap: 2,
      interval: 1000,
    });
  }

  async apiRequest(param) {
    const opt = _.defaultsDeep(param, {
      path: null,
    });

    return this.apiQueue.add(() => got(`${this.root}${opt.path}`).buffer());
  }

  async getFront(param) {
    const opt = _.defaultsDeep(param, {
      releaseId: '5ff81754-2d53-4d0c-a4e4-eb379dc342bf',
    });

    // This will redirect directly to the image buffer.
    return this.apiRequest({
      path: `/release/${opt.releaseId}/front`,
    });
  }
}

module.exports = CoverArtArchive;
