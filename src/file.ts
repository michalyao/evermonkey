import * as fsn from "fs";
import * as bluebird from "bluebird";

const fs = bluebird.Promise.promisifyAll(fsn);

export default fs;

fs.exsit = function (path) {
  return new bluebird.Promise((resolve) => {
    fsn.access(path, fsn.constants.F_OK, err => resolve(!err))
  });
}
