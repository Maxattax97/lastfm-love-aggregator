const _ = require('lodash');
const got = require('got');
const cheerio = require('cheerio');
const { default: PQueue } = require('p-queue');

class LastFM {
  constructor(param) {
    const opt = _.defaultsDeep(param, {
      root: 'http://ws.audioscrobbler.com/2.0/',
    });

    this.root = opt.root;
    this.apiKey = opt.apiKey;
    this.sharedSecret = opt.sharedSecret;

    this.apiQueue = new PQueue({
      intervalCap: 1,
      interval: 1000,
    });

    this.scrapeQueue = new PQueue({
      intervalCap: 2,
      interval: 750,
    });
  }

  async apiRequest(param) {
    const opt = _.defaultsDeep(param, {
      params: {
        api_key: this.apiKey,
        format: 'json',
      },
    });

    return this.apiQueue.add(() => got(this.root, { searchParams: opt.params }).json());
  }

  // TODO: Paginate this, got has a feature for this.
  async userGetLovedTracks(param) {
    const opt = _.defaultsDeep(param, {
      user: 'Maxattax97',
      limit: 50,
      page: 1,
    });

    return this.apiRequest({
      params: {
        method: 'user.getLovedTracks',
        user: opt.user,
        limit: opt.limit,
        page: opt.page,
      },
    });
  }

  async scrapeSong(param) {
    const opt = _.defaultsDeep(param, {
      title: 'Untitled',
      artist: 'Unknown',
      url: 'https://www.last.fm/music/Kali+Uchis/_/Coming+Home+(Interlude)',
    });

    const page = await this.scrapeQueue.add(() => got(opt.url));
    const $ = cheerio.load(page.body);
    const youtubeUrl = $('#track-page-video-playlink').attr('href'); // undefined if it doesn't exist.

    return {
      title: opt.title,
      artist: opt.artist,
      lastfmUrl: opt.url,
      youtubeUrl,
      mbid: opt.mbid,
      artistMbid: opt.artistMbid,
    };
  }

  static parseTracks(tracks) {
    return _.map(tracks, (track) => ({
      title: track.name,
      artist: track.artist.name,
      artistMbid: track.artist.mbid ? track.artist.mbid : undefined, // Could be empty string.
      url: track.url,
      mbid: track.mbid ? track.mbid : undefined, // Could be empty string.
    }));
  }
}

module.exports = LastFM;
