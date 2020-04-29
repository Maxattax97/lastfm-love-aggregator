const _ = require('lodash');
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
        attachments: undefined,
      });

      if (!_.isArray(opt.attachments) && !_.isNil(opt.attachments)) {
        opt.attachments = [opt.attachments];
      }

      const metadata = {
        title: opt.title,
        artist: opt.artist,
        album: opt.album,
        track: opt.track,
        disc: opt.disc,
        label: opt.label,
        date: opt.date,
        Comment: opt.comment, // Note the capital C, tags won't be pickde up otherwise.
      };

      if (opt.attachments && opt.attachments.length >= 1) {
        ffmetadata.write(opt.file, metadata, {
          attachments: opt.attachments,
        }, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(opt);
          }
        });
      } else {
        ffmetadata.write(opt.file, metadata, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(opt);
          }
        });
      }
    });
  }
}

module.exports = Media;
