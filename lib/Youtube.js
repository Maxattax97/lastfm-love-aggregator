const _ = require('lodash');
const fs = require('fs-extra');
const ytdl = require('ytdl-core');
const { Pully, PullyPresets } = require('pully');
const tempy = require('tempy');
const path = require('path');
const { default: PQueue } = require('p-queue');
const Logger = require('./Logger');

class Youtube {
  constructor(param) {
    const opt = _.defaultsDeep(param, {
      storage: tempy.directory(),
    });

    this.apiQueue = new PQueue({
      concurrency: 2,
    });

    this.storage = opt.storage;
    this.index = 0;
  }

  // TODO: use youtube-dl
  // TODO: implement batch support via --batch-file (stdin?)
  // TODO: support default thumbnails
  // TODO: Post process to MP3 or Ogg
  async download(param) {
    const opt = _.defaultsDeep(param, {
      url: null,
      filename: null,
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    if (!opt.filename) {
      opt.filename = `yt${this.index}`;
      this.index += 1;
    }

    // const destination = path.join(this.storage, opt.filename);

    // return this.apiQueue.add(() => new Promise((resolve, reject) => {
    // const dlStream = ytdl(opt.url, {
    // quality: opt.quality,
    // });

    // dlStream.on('error', (err) => reject(err));
    // dlStream.on('end', () => resolve(destination));
    // dlStream.pipe(fs.createWriteStream(destination));
    // }));

    return this.apiQueue.add(() => Pully.download({
      url: opt.url,
      preset: PullyPresets.MP3,
      template: (data) => {
        Logger.debug('Template data: %o', data);
        return opt.filename;
      },
      dir: this.storage,
      progress: (data) => Logger.debug(`${data.percent}%`),
    }));
  }
}

module.exports = Youtube;
