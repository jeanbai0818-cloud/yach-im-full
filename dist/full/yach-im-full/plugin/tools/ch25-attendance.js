/**
 * 知音楼 Agent 工具集 — 考勤打卡
 *
 * 参考实现：/vol2/1000/docker/yach-attendance
 * 纯 JS 重写，不依赖 Python 子进程。
 *
 * 工具列表：
 *   yach_punch_on_duty    — 上班打卡
 *   yach_punch_off_duty   — 下班打卡
 *   yach_attendance_auth_check — 打卡认证状态检查
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
function formatPunchResult(r) {
    const lines = [];
    lines.push(`✅ ${r.check_type} 打卡成功`);
    lines.push(`打卡时间: ${r.after?.check_time || '-'}`);
    lines.push(`地理来源: ${r.geo_source || '-'}`);
    lines.push(`坐标: (${r.used_lon}, ${r.used_lat})`);
    lines.push(`认证来源: ${r.auth_source || '-'}`);
    if (r.record) {
        const rec = r.record;
        lines.push(`服务端返回: code=${rec.code}, msg=${rec.msg || rec.message || '-'}`);
    }
    return lines.join('\n');
}
/** ⭐ 上班打卡 */
export const yachPunchOnDuty = {
    name: "yach_punch_on_duty",
    label: "上班打卡",
    description: "知音楼上班打卡（OnDuty，高风险写操作）。每次调用前必须获得用户对本次上班打卡的明确确认；force=true 覆盖已有记录时必须单独确认。",
    parameters: Type.Object({
        force: Type.Optional(Type.Boolean({ description: "覆盖已有打卡记录" })),
        address: Type.Optional(Type.String({ description: "自定义打卡地址，默认用公司地址" })),
    }),
    async execute(_id, params) {
        const ch7 = require("../../api/ch7-workbench/index.js");
        try {
            const r = await ch7.punchOnDuty({ force: params.force || false, address: params.address || '' });
            return toolResult(formatPunchResult(r));
        }
        catch (e) {
            return toolResult(`❌ 上班打卡失败: ${e.message}`);
        }
    },
};
/** ⭐ 下班打卡 */
export const yachPunchOffDuty = {
    name: "yach_punch_off_duty",
    label: "下班打卡",
    description: "知音楼下班打卡（OffDuty，高风险写操作）。每次调用前必须获得用户对本次下班打卡的明确确认；force=true 覆盖已有记录时必须单独确认。",
    parameters: Type.Object({
        force: Type.Optional(Type.Boolean({ description: "覆盖已有打卡记录" })),
        address: Type.Optional(Type.String({ description: "自定义打卡地址，默认用公司地址" })),
    }),
    async execute(_id, params) {
        const ch7 = require("../../api/ch7-workbench/index.js");
        try {
            const r = await ch7.punchOffDuty({ force: params.force || false, address: params.address || '' });
            return toolResult(formatPunchResult(r));
        }
        catch (e) {
            return toolResult(`❌ 下班打卡失败: ${e.message}`);
        }
    },
};
/** ⭐ 打卡认证状态检查 */
export const yachAttendanceAuthCheck = {
    name: "yach_attendance_auth_check",
    label: "打卡认证检查",
    description: "检查打卡认证状态：是否能成功换票拿到 clockin access_token，以及缓存是否仍有效。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const ch7 = require("../../api/ch7-workbench/index.js");
        try {
            const ctx = await ch7.attendanceAuthCheck({});
            return toolResult(`✅ 打卡认证有效\n` +
                `workcode: ${ctx.workcode}\n` +
                `access_token: 已获取（不回显）\n` +
                `认证来源: ${ctx.auth_source}\n` +
                `坐标: (${ctx.lon}, ${ctx.lat})\n` +
                `地理来源: ${ctx.geo_source}`);
        }
        catch (e) {
            return toolResult(`❌ 打卡认证失败: ${e.message}`);
        }
    },
};
//# sourceMappingURL=ch25-attendance.js.map