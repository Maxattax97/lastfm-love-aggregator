const _ = require('lodash');
const got = require('got');
const cheerio = require('cheerio');
const {default: PQueue} = require('p-queue');

class LastFM {
    constructor(opt) {
        opt = _.defaultsDeep(opt, {
            root: 'http://ws.audioscrobbler.com/2.0/'
        });

        this.root = opt.root;
        this.apiKey = opt.apiKey;
        this.sharedSecret = opt.sharedSecret;

        this.apiQueue = new PQueue({
            intervalCap: 1,
            interval: 1000
        });

        this.scrapeQueue = new PQueue({
            intervalCap: 2,
            interval: 800
        });
    }

    async apiRequest(opt) {
        opt = _.defaultsDeep(opt, {
            params: {
                api_key: this.apiKey,
                format: 'json',
            }
        });

        return this.apiQueue.add(() => got(this.root, { searchParams: opt.params }).json());
    }

    // TODO: Paginate this, got has a feature for this.
    async userGetLovedTracks(opt)
    {
        opt = _.defaultsDeep(opt, {
            user: 'Maxattax97',
            limit: 50,
            page: 1
        });

        return this.apiRequest({ params: {
            method: 'user.getLovedTracks',
            user: opt.user,
            limit: opt.limit,
            page: opt.page
        }});
    }

    async scrapeSong(opt)
    {
        opt = _.defaultsDeep(opt, {
            title: 'Untitled',
            artist: 'Unknown',
            url: 'https://www.last.fm/music/Kali+Uchis/_/Coming+Home+(Interlude)'
        });

        const page = await this.scrapeQueue.add(() => got(opt.url));
        const $ = cheerio.load(page.body);
        const youtubeUrl = $('#track-page-video-playlink').attr("href"); // undefined if it doesn't exist.

        return {
            title: opt.title,
            artist: opt.artist,
            lastfmUrl: opt.url,
            youtubeUrl: youtubeUrl
        }
    }

    parseTracks(tracks)
    {
        return _.map(tracks, (track) => {
            return {
                title: track.name,
                artist: track.artist.name,
                url: track.url
            }
        });
    }
}

module.exports = LastFM;
