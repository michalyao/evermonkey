import * as crypto from "crypto";
import * as mime from "mime";

// md5 hash
export function hash(data) {
  const md5 = crypto.createHash("md5");
  md5.update(data);
  return md5.digest();
}

// guess mime type by filename, if not detected, use as text.
export function guessMime(filename) {
  return mime.lookup(filename) || "text/plain";
}
