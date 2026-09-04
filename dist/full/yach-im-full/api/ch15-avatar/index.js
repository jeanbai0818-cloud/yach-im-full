/**
 * 头像管理
 * 图片头像真实链路：
 * STS → COS PUT → ucenter/user/info/save(pic) → user/info/get 回读
 */
const { get, post } = require('../../utils/request');
const path = require('node:path');
const { uploadToCos } = require('../../utils/cos-upload');

/**
 * 获取头像信息
 * 路由：usergroup/ug/avatar/info
 */
async function getAvatarInfo(userId) {
  if (!userId) throw new Error('[ch15-avatar:getAvatarInfo] userId 必填');
  const r = await post('usergroup/ug/avatar/info', { user_id: String(userId) });
  if (r.code !== 200) throw new Error(`getAvatarInfo failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 上传头像（写操作）
 * 路由：usergroup/ug/avatar/add
 */
async function uploadAvatar(userId, fileUrl) {
  if (!userId) throw new Error('[ch15-avatar:uploadAvatar] userId 必填');
  if (!fileUrl) throw new Error('[ch15-avatar:uploadAvatar] fileUrl 必填');
  const r = await post('usergroup/ug/avatar/add', {
    user_id: String(userId),
    file_url: String(fileUrl),
  });
  if (r.code !== 200) throw new Error(`uploadAvatar failed: ${r.code} ${r.msg}`);
  return r.obj;
}

const AVATAR_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

/**
 * 使用本地图片设置当前登录用户头像。
 * uploadToCos 内部负责允许目录、realpath、普通文件和大小校验。
 */
async function setAvatarImage(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (!AVATAR_EXTENSIONS.has(ext)) {
    throw new Error(`头像文件类型不支持：${ext || '(无扩展名)'}；仅支持 PNG/JPG/JPEG/GIF/WEBP。`);
  }

  const uploaded = await uploadToCos(filePath, { project: 'jsapi' });
  const ch9 = require('../ch9-org/index.js');
  await ch9.setUserInfo({ pic: uploaded.url });
  const card = await ch9.getUserCard();
  if (String(card.avatar || '') !== String(uploaded.url)) {
    throw new Error('头像保存接口返回成功，但回读头像 URL 不一致，已判定更新结果不确定。');
  }
  return {
    cdnUrl: uploaded.url,
    key: uploaded.key,
    verified: true,
  };
}

module.exports = {
  getAvatarInfo,
  uploadAvatar,
  setAvatarImage,
};
