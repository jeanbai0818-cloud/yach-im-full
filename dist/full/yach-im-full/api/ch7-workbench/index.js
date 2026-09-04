/**
 * 第七章：工作台与人事服务 (Workbench & HR)
 *
 * ⭐ 考勤打卡（2026-07-24 真调打通）：
 *   参考实现 /vol2/1000/docker/yach-attendance 已完整逆向打卡 API。
 *   核心流程：capi session → /94capi/ucenter/auth/code → auth_code →
 *     clockin-api.zhiyinlou.com/login/code → 打卡 access_token (Bearer) →
 *     /api/group (查排班) → /api/time/result (预检) → /api/location (地理) →
 *     /api/record (写卡)
 *   纯 JS 重写，不依赖 Python 子进程。
 *   实现在 ./attendance/{client,service}.js
 *
 * ⚠️ 请假 / 报销等仍需运行时抓包，保持占位。
 */

const NOT_IMPLEMENTED =
  '第七章（请假/报销等）在知音楼主 capi 未开放标准 API，需运行时抓包还原真实路由后才能实现。详见 CAPABILITY-MAP.md 第七章。';

function _notImpl(name) {
  return () => { throw new Error(`[ch7:${name}] ${NOT_IMPLEMENTED}`); };
}

// ⭐ OKR（真调打通 2026-07-13）：推翻"OKR 需拓包"旧结论。
//   两步换票：auth/code → okr-api.zhiyinlou.com/api/login/code 拿 Bearer token。
//   业务接口在 okr-api.zhiyinlou.com，实现在 ./okr/{client,service,store}.js（只读）。
const okr = require('./okr/service');
// ✅ 周报（真调验证 2026-07-13）：无需单独换票，就是标准 capi 签名接口 mgo/log/*。
//   实现在 ./weekly/{client,service}.js（对齐旧包 yach-omni-2.1.5 weekly 模块，只读）。
const weekly  = require('./weekly/service');
const { get: _get } = require('../../utils/request');
// ⭐ 考勤打卡（2026-07-24 真调打通）：
//   参考 /vol2/1000/docker/yach-attendance，纯 JS 重写，不依赖 Python。
//   两步换票 + clockin-api.zhiyinlou.com 打卡 API。
const attendance = require('./attendance/service');

module.exports = {
  // ⭐ 考勤打卡（2026-07-24）：纯 JS 重写，不依赖 Python 子进程
  punchOnDuty:   (opts) => attendance.doPunch('OnDuty', opts),
  punchOffDuty:  (opts) => attendance.doPunch('OffDuty', opts),
  // 打卡认证状态检查
  attendanceAuthCheck: (opts) => attendance.getAttendanceAuthContext(opts),
  applyLeave:    _notImpl('applyLeave'),
  applyReimburse:_notImpl('applyReimburse'),
  // OKR 只读能力
  listOkrTemplates: okr.listOkrTemplates,
  listMyOkrs:       okr.listMyOkrs,
  getOkrDetail:     okr.getOkrDetail,
  getCurrentOkrStructure: okr.getCurrentOkrStructure,
  // 周报只读能力
  listWeeklyTemplates:   weekly.listWeeklyTemplates,
  getWeeklyDraft:        weekly.getWeeklyDraft,
  getLastSentWeekly:     weekly.getLastSentWeekly,
  getWeeklyTime:         weekly.getWeeklyTime,
  listReportEmployees:   weekly.listReportEmployees,
  searchUserWeekly:      weekly.searchUserWeekly,   // ⭐⭐ 按指定人查周报（真分页）
  checkWeeklyAuthority:  weekly.checkWeeklyAuthority, // 周报查看权限校验
  commentWeekly:         weekly.commentWeekly,      // ⭐ 给周报评论（写）
  deleteWeeklyComment:   weekly.deleteWeeklyComment, // ⭐ 删除评论（写）
  listReportCategory:    weekly.listReportCategory,  // ⭐ 上报对象分类（读）
  followUserWeekly:      weekly.followUserWeekly,    // ⭐ 关注某人周报（写）
  unfollowUserWeekly:    weekly.unfollowUserWeekly,  // ⭐ 取消关注（写）
  saveWeeklyDraft:       weekly.saveWeeklyDraft,  // 写操作（仅存草稿）
  prepareWeeklySend:     weekly.prepareWeeklySend, // 只读准备一次性发送令牌
  submitWeekly:          weekly.submitWeekly,      // 不可逆发送
  listSentWeekly:        weekly.listSentWeekly,
  listReceivedWeekly:    weekly.listReceivedWeekly,
  listWeeklyEvents:      weekly.listWeeklyEvents,
  listWeeklyWeeks:       weekly.listWeeklyWeeks,
  listStarWeekly:        weekly.listStarWeekly,
  getWeeklyDetail:       weekly.getWeeklyDetail,
  getWeeklyReaders:      weekly.getWeeklyReaders,
  markWeeklyRead:        weekly.markWeeklyRead,      // ⭐ 标记周报已读（写）
  getWeeklyReceiveConfig: weekly.getWeeklyReceiveConfig,
  zanWeekly:             weekly.zanWeekly,  // 写操作（点赞）
  cancelZanWeekly:       weekly.cancelZanWeekly,  // 写操作（取消点赞）
  getWeeklyZanUsers:     weekly.getWeeklyZanUsers,
  getWeeklyComments:     weekly.getWeeklyComments,
  getWeeklyZanReadBatch: weekly.getWeeklyZanReadBatch,
  listUnreadWeekly:      weekly.listUnreadWeekly,
  // ⭐ 考勤状态（2026-07-14 真调验证 com694/attendance/info）
  getAttendanceInfo,
  _status: { implemented: false, reason: NOT_IMPLEMENTED, okr: true, weekly: true },
};

/**
 * 获取考勤状态（上下班打卡状态 + 服务器时间）
 * 路由：com694/attendance/info（真调验证 2026-07-14）
 *
 * 返回示例：
 *   { command: 'stop', server_time: 1783997598, timer_interval: 60, end_time: 0 }
 *   command: 'stop'  内网考勤已关，'start' 为开启内网打卡
 *
 * @returns {Promise<{command,server_time,timer_interval,end_time}>}
 */
async function getAttendanceInfo() {
  const r = await _get('com694/attendance/info');
  if (r.code !== 200) throw new Error(`getAttendanceInfo failed: ${r.code} ${r.msg}`);
  return r.obj && r.obj.attendance ? r.obj.attendance : r.obj;
}
