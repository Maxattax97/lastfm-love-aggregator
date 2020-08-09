const _ = require('lodash');
const got = require('got');
const dotProp = require('dot-prop');
const Moment = require('moment');
const { default: PQueue } = require('p-queue');
const Logger = require('./Logger');

// https://musicbrainz.org/doc/MusicBrainz_API
class MusicBrainz {
  constructor(param) {
    const opt = _.defaultsDeep(param, {
      root: 'https://musicbrainz.org/ws/2/',
    });

    this.root = opt.root;
    this.userAgent = opt.userAgent;

    this.apiQueue = new PQueue({
      intervalCap: 3,
      interval: 2000,
    });
  }

  async apiRequest(param) {
    let opt = _.defaultsDeep(param, {
      command: 'lookup',
      entityType: 'release', // area, artist, event, genre, instrument, label, place, recording, release, release-group, series, work, url
      where: 'track',
      params: {
        fmt: 'json',
      },
      mbid: null,
    });

    if (opt.command === 'lookup') {
      opt = _.defaultsDeep(opt, {
        params: {
          inc: 'artists+collections+labels+recordings', // +release-groups
        },
      });

      return this.apiQueue.add(() => got(`${this.root}${opt.entityType}/${opt.mbid}`, {
        headers: {
          'user-agent': this.userAgent,
        },
        searchParams: opt.params,
      }).json());
    } if (opt.command === 'browse') {
      opt = _.defaultsDeep(opt, {
        params: {
          inc: 'artist-credits+recordings+release-groups+media+tags',
          // 'artist-credits+labels+recordings+release-groups+media+discids+isrcs',
        },
      });

      opt.params[opt.where] = opt.mbid;

      return this.apiQueue.add(() => got(`${this.root}${opt.entityType}`, {
        headers: {
          'user-agent': this.userAgent,
        },
        searchParams: opt.params,
      }).json());
    }

    throw new Error('Command is not implemented');
  }

  async release(param) {
    const opt = _.defaultsDeep(param, {
      mbid: null,
    });

    return this.apiRequest({
      command: 'lookup',
      entityType: 'release',
      mbid: opt.mbid,
    });
  }

  async track(param) {
    const opt = _.defaultsDeep(param, {
      mbid: null,
    });

    return this.apiRequest({
      command: 'browse',
      entityType: 'release',
      where: 'track',
      mbid: opt.mbid,
    });
  }

  static parseTrack(param) {
    const opt = _.defaultsDeep(param, {
      trackId: null,
      apiResponse: null,
    });

    const releaseId = dotProp.get(opt.apiResponse, 'releases.0.id');
    const tracks = dotProp.get(opt.apiResponse, 'releases.0.media.0.tracks');
    const album = dotProp.get(opt.apiResponse, 'releases.0.title');
    const topLevelTags = dotProp.get(opt.apiResponse, 'releases.0.tags', []);
    const track = _.find(tracks, { id: opt.trackId });
    if (track) {
      const title = dotProp.get(track, 'recording.title');
      const artist = dotProp.get(track, 'recording.artist-credit.0.name');
      let tags = dotProp.get(track, 'recording.tags', []);
      if (!tags || tags.length <= 0) {
        tags = topLevelTags;
      }

      let date = dotProp.get(opt.apiResponse, 'releases.0.date');
      if (date) {
        const dateTime = new Moment(date);
        date = dateTime.year();
      }

      let position = dotProp.get(track, 'position');
      if (position) {
        position = `${position}/${dotProp.get(opt.apiResponse, 'releases.0.media.track-count', tracks.length)}`;
      }

      return {
        mbid: opt.trackId,
        releaseId,
        title,
        artist,
        album,
        date,
        position,
        tags,
      };
    }

    throw new Error('Could not find track in release');
  }
}

module.exports = MusicBrainz;
