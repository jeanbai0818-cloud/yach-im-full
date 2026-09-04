/**
 * 知音楼 Agent 工具集 — 时区管理
 *
 * 调用 API: ../../api/ch26-timezone/index.js
 *
 * 工具列表：
 *   yachGetTimezoneList        — 时区列表
 *   yachSaveTimezone           — 保存时区（写）
 *   yachGetSupportTimezoneList — 支持时区列表
 *   yachDeleteTimezone         — 删除时区（写）
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetTimezoneList = {
    name: "yach_get_timezone_list",
    label: "我的时区列表",
    description: "获取当前账号已保存的时区列表。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch26 = require("../../api/ch26-timezone/index.js");
        const result = await ch26.getCustomTimezoneList();
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachSaveTimezone = {
    name: "yach_save_timezone",
    label: "保存时区（写）",
    description: "保存/更新时区配置。写操作，执行前需用户确认。",
    parameters: Type.Object({
        timezone: Type.String({ description: "时区标识，如 Asia/Shanghai" }),
        identifier: Type.Optional(Type.String({ description: "IANA 时区标识；默认同 timezone" })),
        isCustom: Type.Optional(Type.Union([Type.Literal(0), Type.Literal(1)], { description: "0=系统时区，1=自定义；默认 1" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch26 = require("../../api/ch26-timezone/index.js");
        const config = { timezone: params.timezone };
        if (params.identifier != null)
            config.identifier = params.identifier;
        if (params.isCustom != null)
            config.is_custom = params.isCustom;
        const result = await ch26.saveTimezone(config);
        return toolResult(`✅ 已保存时区 ${params.timezone}\n${JSON.stringify(result)}`);
    },
};
export const yachGetSupportTimezoneList = {
    name: "yach_get_support_timezone_list",
    label: "支持时区列表",
    description: "获取系统支持的所有时区列表（含偏移量、地区等）。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch26 = require("../../api/ch26-timezone/index.js");
        const result = await ch26.getSupportTimezoneList();
        const list = Array.isArray(result) ? result : (result?.list || result?.timezones || []);
        if (!list.length)
            return toolResult(JSON.stringify(result, null, 2));
        const lines = list.slice(0, 20).map((t) => `  ${t.value || t.timezone} — ${t.name || t.label || ""} (UTC${t.offset || ""})`);
        return toolResult(`支持时区共 ${list.length} 个（显示前 20 个）：\n${lines.join("\n")}${list.length > 20 ? `\n...还有 ${list.length - 20} 个` : ""}`);
    },
};
export const yachDeleteTimezone = {
    name: "yach_delete_timezone",
    label: "删除时区（写）",
    description: "删除一个已保存的时区。写操作，执行前需用户确认。",
    parameters: Type.Object({
        timezoneId: Type.Integer({ minimum: 1, description: "时区配置的正整数 id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch26 = require("../../api/ch26-timezone/index.js");
        const result = await ch26.deleteTimezone(params.timezoneId);
        return toolResult(`✅ 已删除时区配置 timezoneId=${params.timezoneId}\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch17-timezone.js.map