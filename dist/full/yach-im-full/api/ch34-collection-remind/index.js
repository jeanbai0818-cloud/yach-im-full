/**
 * 收藏提醒
 * 路由来源：682api.js (前缀 682)
 */
const { post } = require('../../utils/request');

/**
 * 收藏提醒设置
 * 路由：682/client/api/collection/remind
 */
async function setCollectionRemind(collectionId, remind) {
  if (!collectionId) throw new Error('[ch34-collection-remind:setCollectionRemind] collectionId 必填');
  const r = await post('682/client/api/collection/remind', {
    collection_id: String(collectionId),
    remind: remind ? 1 : 0,
  });
  if (r.code !== 200) throw new Error(`setCollectionRemind failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  setCollectionRemind,
};
