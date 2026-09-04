/**
 * 短链
 * 路由来源：615api.js (前缀 615bsvr)
 */
const { postJson } = require('../../utils/request');

/**
 * 短链接转长链
 * 路由：615bsvr/slink/get/long
 */
async function shortLinkTransLong(shortUrl) {
  if (!shortUrl) throw new Error('[ch32-shortlink:shortLinkTransLong] shortUrl 必填');
  const r = await postJson('615bsvr/slink/get/long', { link: String(shortUrl) });
  if (r.code !== 200) throw new Error(`shortLinkTransLong failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

module.exports = {
  shortLinkTransLong,
};
