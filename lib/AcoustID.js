const _ = require('lodash');
const got = require('got');
const {default: PQueue} = require('p-queue');
const fpcalc = require('fpcalc');
const ffmetadata = require('ffmetadata');

// https://acoustid.org/webservice
class AcoustID {
    constructor(opt) {
        opt = _.defaultsDeep(opt, {
            root: 'https://api.acoustid.org/v2/'
        });

        this.root = opt.root;
        this.apiKey = opt.apiKey;

        this.apiQueue = new PQueue({
            intervalCap: 3,
            interval: 1000
        });

        // https://musicbrainz.org/doc/Cover_Art_Archive/API
        this.apiQueue = new PQueue({
            intervalCap: 3,
            interval: 1000
        });
    }

    async apiRequest(opt) {
        opt = _.defaultsDeep(opt, {
            command: 'lookup',
            params: {
                client: this.apiKey,
                format: 'json',
            }
        });

        return this.apiQueue.add(() => got(`${this.root}lookup`, { searchParams: opt.params }).json());
    }

    async lookup(opt)
    {
        opt = _.defaultsDeep(opt, {
            file: null,
            fingerprint: null,
            duration: null,
            meta: 'recordings releasegroups releases compress usermeta tracks'
        });

        if (opt.file)
        {
            const scan = await this.getFingerprint({
                file: opt.file
            });

            opt.fingerprint = scan.fingerprint;
            opt.duration = scan.duration;
        }

        return this.apiRequest({ 
            command: 'lookup',
            params: {
                fingerprint: opt.fingerprint,
                duration: opt.duration,
                meta: opt.meta
            }
        });
    }

    async getFingerprint(opt)
    {
        return new Promise((resolve, reject) => {
            fpcalc(opt.file, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    // TODO: Rename (move) file too?
    async setMetadata(opt)
    {
        return new Promise((resolve, reject) => {
            opt = _.defaultsDeep(opt, {
                file: null,
                attachments: null
            });

            ffmetadata.write(file, {
                title: opt.title,
                artist: opt.artist,
                album: opt.album,
                track: opt.track,
                disc: opt.disc,
                label: opt.label,
                date: opt.date,
            }, opt.attachments, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(opt);
                }
            });
        });
    }

    parseTrack(apiResponse)
    {
        const bestFit = _.maxBy(apiResponse.results, (o) => o.score);

        const result = {};

        result.mbid = bestFit.id;
        result.score = bestFit.score;

        try {
            result.title = bestFit.recordings[0].title;
        } catch(err) {
            console.error('Failed to fetch title');
        }

        try {
            result.artist = bestFit.recordings[0].artists[0].name;
        } catch(err) {
            console.error('Failed to fetch artist');
        }

        try {
            result.album = bestFit.recordings[0].releasegroups[0].title;
        } catch(err) {
            console.error('Failed to fetch album');
        }

        let earliest = null;
        try {
            earliest = _.minBy(bestFit.recordings[0].releasegroups[0].releases, (release) => {
                if (release.date) {
                    return release.date.year;
                }
            });
            result.date = earliest.date.year;
            result.releaseId = earliest.id;
        } catch(err) {
            console.error('Failed to fetch earliest release');
        }

        if (earliest) {
            try {
                const pos = earliest.mediums[0].position;
                const count = earliest.mediums[0].track_count;

                result.track = `${pos}/${count}`;
            } catch(err) {
                console.error('Failed to fetch track');
            }
        }

        return result;
    }
}

module.exports = AcoustID;
