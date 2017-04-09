import * as fsn from 'fs';
import * as bluebird from 'bluebird';

const fs = bluebird.Promise.promisifyAll(fsn);

export default fs;
