const _ = require('lodash');
const got = require('got');
const {default: PQueue} = require('p-queue');

// https://musicbrainz.org/doc/Cover_Art_Archive/API
class CoverArtArchive {
    constructor(opt) {
        opt = _.defaultsDeep(opt, {
            root: 'https://coverartarchive.org'
        });

        this.root = opt.root;

        this.apiQueue = new PQueue({
            intervalCap: 2,
            interval: 1000
        });
    }

    async apiRequest(opt) {
        opt = _.defaultsDeep(opt, {
            path: null,
        });

        return this.apiQueue.add(() => got(`${this.root}${opt.path}`).buffer());
    }

    async getFront(opt)
    {
        opt = _.defaultsDeep(opt, {
            releaseId: '5ff81754-2d53-4d0c-a4e4-eb379dc342bf'
        });

        // This will redirect directly to the image buffer.
        return this.apiRequest({ 
            path: `/release/${opt.releaseId}/front`,
        });
    }
}

module.exports = CoverArtArchive;
