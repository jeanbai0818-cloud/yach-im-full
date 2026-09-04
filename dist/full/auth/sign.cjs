'use strict';

const crypto = require('node:crypto');

const SIGN_SECRET = '59266f227cfd7a67797012108df99c9b';

function getSign(data = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { ...data, timestamp };
  const text = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] === undefined ? '' : params[key]}&`)
    .join('') + `key=${SIGN_SECRET}`;
  return {
    sign: crypto.createHash('md5').update(text).digest('hex'),
    timestamp,
  };
}

module.exports = { getSign };
