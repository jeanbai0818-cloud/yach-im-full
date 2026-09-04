/**
 * 群顶栏卡片
 * 路由来源：usergroup.js (前缀 usergroup)
 * 子模块 group/ceilingcard/*
 */
const { get, post } = require('../../utils/request');

/**
 * 获取群顶栏卡片列表
 * 路由：usergroup/group/ceilingcard/list
 */
async function getCeilingCardList(tid) {
  if (!tid) throw new Error('[ch18-ceiling-card:getCeilingCardList] tid 必填');
  const r = await post('usergroup/group/ceilingcard/list', { team_id: String(tid) });
  if (r.code !== 200) throw new Error(`getCeilingCardList failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 关闭群顶栏卡片（写操作）
 * 路由：usergroup/group/ceilingcard/list/close
 */
async function closeCeilingCard(tid, cardId) {
  if (!tid) throw new Error('[ch18-ceiling-card:closeCeilingCard] tid 必填');
  const r = await post('usergroup/group/ceilingcard/list/close', {
    team_id: String(tid),
    card_id: cardId ? String(cardId) : '',
  });
  if (r.code !== 200) throw new Error(`closeCeilingCard failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getCeilingCardList,
  closeCeilingCard,
};
