/**
 * 知音楼接口签名工具
 * 算法：MD5(sorted(key=val& ...) + key=<SECRET>)
 */
const crypto = require('crypto');
const SECRET = '59266f227cfd7a67797012108df99c9b';

function getSign(data = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { ...data, timestamp };
  const keys = Object.keys(params).sort();
  let str = '';
  keys.forEach(k => {
    const v = params[k] === undefined ? '' : params[k];
    str += `${k}=${v}&`;
  });
  str += `key=${SECRET}`;
  const sign = crypto.createHash('md5').update(str).digest('hex');
  return { sign, timestamp };
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = { getSign, md5 };
