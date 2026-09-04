/**
 * 投票详情/计数
 * 路由来源：bsvr.js + 636api.js
 */
const { get, post } = require('../../utils/request');

/**
 * 获取投票详情
 * 路由：bsvr/vote/detail
 */
async function getVoteDetail(voteId, opts = {}) {
  if (!voteId) throw new Error('[ch31-vote:getVoteDetail] voteId 必填');
  const msgId = String(opts.msgId || voteId);
  const payload = {
    ids: JSON.stringify([{ vid: String(voteId), msg_id: msgId }]),
  };
  if (opts.sessionId) payload.sessionId = String(opts.sessionId);
  const r = await post('bsvr/vote/detail', payload);
  if (r.code !== 200) throw new Error(`getVoteDetail failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 添加投票选择（写操作）
 * 路由：bsvr/vote/choice/add
 */
async function addVoteChoice(voteId, choiceIds, teamId) {
  if (!voteId) throw new Error('[ch31-vote:addVoteChoice] voteId 必填');
  if (!Array.isArray(choiceIds)) throw new Error('[ch31-vote:addVoteChoice] choiceIds 必填');
  const payload = {
    vote_id: String(voteId),
    choice_ids: JSON.stringify(choiceIds.map(String)),
  };
  if (teamId) payload.team_id = String(teamId);
  const r = await post('bsvr/vote/choice/add', payload);
  if (r.code !== 200) throw new Error(`addVoteChoice failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 投票消息绑定
 * 路由：bsvr/vote/msg/binding
 */
async function getVoteMsgBinding(msgId) {
  if (!msgId) throw new Error('[ch31-vote:getVoteMsgBinding] msgId 必填');
  const r = await post('bsvr/vote/msg/binding', { msg_id: String(msgId) });
  if (r.code !== 200) throw new Error(`getVoteMsgBinding failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取投票计数
 * 路由：636_ai/intelloft/client/msg/share/vote/count
 */
async function getIntelloftVoteCount(uniq) {
  if (!uniq) throw new Error('[ch31-vote:getIntelloftVoteCount] uniq 必填');
  const r = await get('636_ai/intelloft/client/msg/share/vote/count', { uniq: String(uniq) });
  if (r.code !== 200) throw new Error(`getIntelloftVoteCount failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 投票（写操作）
 * 路由：636_ai/intelloft/client/msg/share/vote
 */
async function intelloftVote(opts = {}) {
  if (!opts.share_id) throw new Error('[ch31-vote:intelloftVote] share_id 必填');
  const r = await post('636_ai/intelloft/client/msg/share/vote', {
    share_id: String(opts.share_id),
    choices: JSON.stringify(opts.choices || []),
  });
  if (r.code !== 200) throw new Error(`intelloftVote failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getVoteDetail,
  addVoteChoice,
  getVoteMsgBinding,
  getIntelloftVoteCount,
  intelloftVote,
};
