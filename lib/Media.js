const fpcalc = require('fpcalc');
const ffmetadata = require('ffmetadata');

class Media {
  static async getFingerprint(opt) {
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
  static async setMetadata(param) {
    return new Promise((resolve, reject) => {
      const opt = _.defaultsDeep(param, {
        file: null,
        attachments: null,
      });

      ffmetadata.write(opt.file, {
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
}

module.exports = Media;
