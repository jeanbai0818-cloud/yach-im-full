/**
 * 知音楼文件上传工具
 *
 * 还原自桌面端 ipc-main/file/index.js fileUploadNew 函数。
 *
 * 上传链路：
 *   1. GET 94capi/platform/tencent/sts?type=file  → 腾讯云 COS 临时凭证
 *   2. cos-nodejs-sdk-v5 putObject 上传文件
 *      Key = online/person/{timestamp}/{rand}/{uuid-v4}{ext}
 *   3. 返回 CDN URL：https://yach-static.zhiyinlou.com/{key}
 *
 * 关键发现（来自逆向）：
 *   - STS 接口是 GET（POST 返回 405）
 *   - 参数字段是 type（不是 costype/cosType）
 *   - type=file 有效，type=person 无效
 *   - 手机端只认 yach-static.zhiyinlou.com，不认 NIM NOS
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const COS = require('cos-nodejs-sdk-v5');
const { get } = require('./request');
const { resolveSafeFile } = require('./safe-file');

const CDN_DOMAIN = 'https://yach-static.zhiyinlou.com';

/** 获取腾讯云 COS 临时凭证 */
async function getCosSts() {
  const r = await get('94capi/platform/tencent/sts', { type: 'file' });
  if (r.code !== 200 || !r.obj) throw new Error(`STS failed: ${r.code} ${r.msg}`);
  return r.obj;
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 上传本地文件到知音楼 COS
 * @param {string} filePath  本地文件路径
 * @param {object} opts      { project: 'person'|'group', env: 'online' }
 * @returns {Promise<{url, key, name, size, ext}>}
 */
async function uploadToCos(filePath, opts = {}) {
  filePath = resolveSafeFile(filePath);
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const ext = path.extname(filePath); // 含点，如 .zip
  const project = opts.project || 'person';
  const env = opts.env || 'online';

  const sts = await getCosSts();

  // Key = {env}/{project}/{timestamp}/{rand}/{uuid}{ext}（照桌面端 fileUploadNew）
  const key = `${env}/${project}/${Date.now()}/${Math.random().toString(36).slice(2)}/${uuidv4()}${ext}`;

  const cos = new COS({
    getAuthorization(options, cb) {
      cb({
        TmpSecretId: sts.credentials.tmpSecretId,
        TmpSecretKey: sts.credentials.tmpSecretKey,
        SecurityToken: sts.credentials.stsToken,
        StartTime: sts.startTime,
        ExpiredTime: sts.expiredTime,
      });
    },
  });

  await new Promise((resolve, reject) => {
    cos.putObject({ Bucket: sts.bucket, Region: sts.region, Key: key, Body: buf },
      (err, data) => err ? reject(new Error(`COS putObject failed: ${JSON.stringify(err).slice(0, 200)}`)) : resolve(data)
    );
  });

  return {
    url: `${CDN_DOMAIN}/${key}`,
    key, name,
    size: buf.length,
    ext: ext.slice(1).toLowerCase(),
  };
}

module.exports = { getCosSts, uploadToCos };
