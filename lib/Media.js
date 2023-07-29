import path from 'node:path';
import url from 'node:url';
import _ from 'lodash';
import fs from 'fs-extra';
import fpcalc from 'fpcalc';
import ffmetadata from 'ffmetadata';

export default class Media {
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
        Comment: opt.comment, // Note the capital C, tags won't be picked up otherwise.
      };

      if (opt.attachments && opt.attachments.length >= 1) {
        ffmetadata.write(
          opt.file,
          metadata,
          {
            attachments: opt.attachments,
          },
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(opt);
            }
          },
        );
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

  static async getMetadata(param) {
    return new Promise((resolve, reject) => {
      const opt = _.defaultsDeep(param, {
        file: null,
      });

      ffmetadata.read(opt.file, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  static async scanDirectory(param) {
    const opt = _.defaultsDeep(param, {
      directory: url.fileURLToPath(import.meta.url),
      recurse: true,
      arrayOfFiles: [],
      depth: 0,
      data: [],
    });

    const files = await fs.readdir(opt.directory);

    const queue = [];
    _.each(files, (file) => {
      queue.push(
        (async () => {
          const stats = await fs.stat(`${opt.directory}/${file}`);
          const isDirectory = stats.isDirectory();
          if (opt.recurse && isDirectory) {
            opt.arrayOfFiles = await Media.scanDirectory({
              directory: `${opt.directory}/${file}`,
              recurse: opt.recurse,
              arrayOfFiles: opt.arrayOfFiles,
              depth: opt.depth + 1,
              data: opt.data,
            });
          } else if (!isDirectory) {
            const filepath = path.join(opt.directory, '/', file);
            opt.arrayOfFiles.push(filepath);

            const meta = await Media.getMetadata({
              file: filepath,
            });

            opt.data.push(meta);
          }
        })(),
      );
    });

    await Promise.all(queue);
    if (opt.depth !== 0) {
      return opt.arrayOfFiles;
    }
    return opt.data;
  }
}
