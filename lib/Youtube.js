const _ = require('lodash');
const del = require('del');
const fs = require('fs-extra');
const youtubedl = require('youtube-dl');
const tempy = require('tempy');
const path = require('path');
const { default: PQueue } = require('p-queue');
// const child_process = require('child_process');
const Logger = require('./Logger');

class Youtube {
  constructor(param) {
    const opt = _.defaultsDeep(param, {
      storage: tempy.directory(),
      threads: 2,
    });

    this.apiQueue = new PQueue({
      concurrency: opt.threads,
    });

    this.storage = opt.storage;
    this.index = 0;
  }

  async cleanup() {
    return del(this.storage, { force: true });
  }

  /*
    [youtube] AqqaavQzPtI: Downloading webpage
    [youtube] AqqaavQzPtI: Downloading thumbnail ...
    [youtube] AqqaavQzPtI: Writing thumbnail to: AqqaavQzPtI.jpg
    [download] Destination: AqqaavQzPtI.mp4
    [download] 100% of 15.69MiB in 00:0120MiB/s ETA 00:009
    [ffmpeg] Destination: AqqaavQzPtI.mp3
    Deleting original file AqqaavQzPtI.mp4 (pass -k to keep)
    [ffmpeg] Adding thumbnail to "AqqaavQzPtI.mp3"
  */
  static parseYoutubeDlLogs(logs) {
    const regex = /\s(.*):/gm;
    const str = logs[0];
    let m;

    const result = {};

    // eslint-disable-next-line no-cond-assign
    while ((m = regex.exec(str)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex += 1;
      }

      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex === 1) {
          result.id = match;
        }
      });
    }

    return result;
  }

  // If you get the error:
  // ERROR: No video formats found; please report this issue on https://yt-dl.org/bug . Make sure you are using the latest version; type  youtube-dl -U  to update. Be sure to call youtube-dl with the --verbose flag and include its complete output.
  // When running manually, you need to update youtube-dl.
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

    return this.apiQueue.add(() => new Promise((resolve, reject) => {
      // youtube-dl-gui produces this (example for `Solene - Downer Vibe`):
      // youtube-dl --newline -i -o "/home/max/Downloads/ytdl-tests/%(title)s.%(ext)s" -x --audio-format mp3 --ignore-config --hls-prefer-native --embed-thumbnail --add-metadata "https://www.youtube.com/watch?v=tCm8gUyZZDI"
      // child_process.execFile('youtube-dl', [opt.url, '--write-thumbnail', '-x', '--audio-format', 'mp3', '--id', '--verbose'], {

	  // `--id` === `-o %(id)s.%(ext)s` in youtube-dl vs yt-dlp
      youtubedl.exec(opt.url, ['--write-thumbnail', '-x', '--audio-format', 'mp3', '-o', '%(id)s.%(ext)s'], {
        cwd: this.storage,
      }, (err, output) => {
      // }, (err, stdout, stderr) => {
        if (err) {
          if (output) {
            return reject(new Error(`youtube-dl/ffmpeg encountered an error: ${output}`));
          }
          return reject(err);
        }
        // const parsed = Youtube.parseYoutubeDlLogs(stdout.split('\n'));
        const parsed = Youtube.parseYoutubeDlLogs(output);
        const destination = `${path.join(this.storage, parsed.id)}.mp3`;

        let thumbDest = `${path.join(this.storage, parsed.id)}.jpg`;
        return fs.access(thumbDest).then(() => resolve({
          path: destination,
          thumbnailPath: thumbDest,
        })).catch(() => {
          thumbDest = `${path.join(this.storage, parsed.id)}.webp`;
          return fs.access(thumbDest).then(() => resolve({
            path: destination,
            thumbnailPath: thumbDest,
          })).catch((thumbWebpErr) => reject(thumbWebpErr));
        });
      });
    }));

    // ytdl-core method
    // return this.apiQueue.add(() => new Promise((resolve, reject) => {
    // const dlStream = ytdl(opt.url, {
    // quality: opt.quality,
    // });
    // dlStream.on('error', (err) => reject(err));
    // dlStream.on('end', () => resolve(destination));
    // dlStream.pipe(fs.createWriteStream(destination));
    // }));

    // Pully method
    // return this.apiQueue.add(() => Pully.download({
    // url: opt.url,
    // preset: PullyPresets.MP3,
    // template: (data) => {
    // Logger.debug('Template data: %o', data);
    // return opt.filename;
    // },
    // dir: this.storage,
    // progress: (data) => Logger.debug(`${data.percent}%`),
    // }));
  }
}

module.exports = Youtube;
