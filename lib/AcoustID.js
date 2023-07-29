import _ from 'lodash';
import got from 'got';
import PQueue from 'p-queue';
import Logger from './Logger.js';
import Media from './Media.js';

// https://acoustid.org/webservice
export default class AcoustID {
  constructor(param) {
    const opt = _.defaultsDeep(param, {
      root: 'https://api.acoustid.org/v2/',
    });

    this.root = opt.root;
    this.apiKey = opt.apiKey;

    this.apiQueue = new PQueue({
      intervalCap: 3,
      interval: 1000,
    });
  }

  async apiRequest(param) {
    const opt = _.defaultsDeep(param, {
      command: 'lookup',
      params: {
        client: this.apiKey,
        format: 'json',
      },
    });

    return this.apiQueue.add(() => got(`${this.root}lookup`, { searchParams: opt.params }).json());
  }

  async lookup(param) {
    const opt = _.defaultsDeep(param, {
      file: null,
      fingerprint: null,
      duration: null,
      meta: 'recordings releasegroups releases compress usermeta tracks',
    });

    if (opt.file) {
      const scan = await Media.getFingerprint({
        file: opt.file,
      });

      opt.fingerprint = scan.fingerprint;
      opt.duration = scan.duration;
    }

    return this.apiRequest({
      command: 'lookup',
      params: {
        fingerprint: opt.fingerprint,
        duration: opt.duration,
        meta: opt.meta,
      },
    });
  }

  static parseTrack(apiResponse) {
    const bestFit = _.maxBy(apiResponse.results, (o) => o.score);

    const result = {};

    result.mbid = bestFit.id;
    result.score = bestFit.score;

    try {
      result.title = bestFit.recordings[0].title;
    } catch (err) {
      Logger.warn(`Failed to fetch title for ${result.mbid}`);
    }

    try {
      result.artist = bestFit.recordings[0].artists[0].name;
    } catch (err) {
      Logger.warn(`Failed to fetch artist for ${result.title || result.mbid}`);
    }

    try {
      result.album = bestFit.recordings[0].releasegroups[0].title;
    } catch (err) {
      Logger.warn(`Failed to fetch album for ${result.title || result.mbid}`);
    }

    let earliest = null;
    try {
      earliest = _.minBy(
        bestFit.recordings[0].releasegroups[0].releases,
        (release) => {
          if (release.date) {
            return release.date.year;
          }
          return undefined;
        },
      );
      result.date = earliest.date.year;
      result.releaseId = earliest.id;
    } catch (err) {
      Logger.warn(
        `Failed to fetch earliest release for ${result.title || result.mbid}`,
      );
    }

    if (earliest) {
      try {
        const pos = earliest.mediums[0].position;
        const count = earliest.mediums[0].track_count;

        result.track = `${pos}/${count}`;
      } catch (err) {
        Logger.warn(`Failed to fetch track for ${result.title || result.mbid}`);
      }
    }

    return result;
  }
}
