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
const attendanceParameters = () => Type.Object({
    latitude: Type.Number({ description: "调用方提供的实际纬度（-90 到 90）；不会使用默认坐标" }),
    longitude: Type.Number({ description: "调用方提供的实际经度（-180 到 180）；不会使用默认坐标" }),
    deviceId: Type.String({ description: "调用方明确提供的设备标识；插件不会生成或伪造" }),
    deviceName: Type.String({ description: "调用方明确提供的设备名称；插件不会从系统主机名推导" }),
    deviceBrand: Type.Optional(Type.String({ description: "服务端要求时填写真实设备品牌" })),
    deviceModel: Type.Optional(Type.String({ description: "服务端要求时填写真实设备型号" })),
    deviceVersion: Type.Optional(Type.String({ description: "服务端要求时填写真实客户端版本" })),
    networkType: Type.Optional(Type.String({ description: "服务端要求时填写真实网络类型" })),
    systemVersion: Type.Optional(Type.String({ description: "服务端要求时填写真实系统版本" })),
    platform: Type.Optional(Type.String({ description: "服务端要求时填写真实平台标识" })),
    clientVersion: Type.Optional(Type.String({ description: "服务端要求时填写真实客户端版本" })),
    clientRelease: Type.Optional(Type.String({ description: "服务端要求时填写真实客户端发布版本" })),
    force: Type.Optional(Type.Boolean({ description: "覆盖已有打卡记录" })),
    address: Type.Optional(Type.String({ description: "真实打卡地址；为空时使用服务端已有排班地址" })),
});
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
    description: "知音楼上班打卡（OnDuty，高风险写操作）。每次调用前必须获得用户对本次上班打卡的明确确认，并由调用方提供真实坐标和设备信息；插件不会生成定位或伪造设备。force=true 覆盖已有记录时必须单独确认。",
    parameters: attendanceParameters(),
    async execute(_id, params) {
        const ch7 = require("../../api/ch7-workbench/index.js");
        try {
            const r = await ch7.punchOnDuty(params);
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
    description: "知音楼下班打卡（OffDuty，高风险写操作）。每次调用前必须获得用户对本次下班打卡的明确确认，并由调用方提供真实坐标和设备信息；插件不会生成定位或伪造设备。force=true 覆盖已有记录时必须单独确认。",
    parameters: attendanceParameters(),
    async execute(_id, params) {
        const ch7 = require("../../api/ch7-workbench/index.js");
        try {
            const r = await ch7.punchOffDuty(params);
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
    description: "检查打卡认证状态：使用调用方提供的真实坐标和设备信息换票；不会生成、伪造或从系统读取设备/定位数据。",
    parameters: attendanceParameters(),
    async execute(_id, params) {
        const ch7 = require("../../api/ch7-workbench/index.js");
        try {
            const ctx = await ch7.attendanceAuthCheck(params);
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
