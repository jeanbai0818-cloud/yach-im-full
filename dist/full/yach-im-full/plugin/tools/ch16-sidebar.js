/**
 * 侧栏配置工具
 * 对应 API: src/api/ch16-sidebar/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetSideBarConf = {
    name: "yach_get_side_bar_conf",
    label: "查侧栏配置",
    description: "查询侧栏应用配置。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const ch = require("../../api/ch16-sidebar/index.js");
        const result = await ch.getSideBarConf();
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachSetSideBarConf = {
    name: "yach_set_side_bar_conf",
    label: "设侧栏配置",
    description: "设置侧栏配置。写操作，需确认。",
    parameters: Type.Object({
        config: Type.Union([Type.String(), Type.Object({})], { description: "配置对象或 JSON 字符串" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch16-sidebar/index.js");
        const result = await ch.saveSideBarConf(params.config);
        return toolResult(`✅ 已设置侧栏配置\n${JSON.stringify(result)}`);
    },
};
export const yachAddSideBarNav = {
    name: "yach_add_side_bar_nav",
    label: "添加侧栏导航",
    description: "添加侧栏导航应用。写操作，需确认。",
    parameters: Type.Object({
        appId: Type.String({ description: "应用唯一 id（app_unique_id）" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch16-sidebar/index.js");
        const result = await ch.addSideBarNav(params.appId);
        return toolResult(`✅ 已添加侧栏导航\n${JSON.stringify(result)}`);
    },
};
export const yachDelSideBarNav = {
    name: "yach_del_side_bar_nav",
    label: "删除侧栏导航",
    description: "删除侧栏导航应用。写操作，需确认。",
    parameters: Type.Object({
        appId: Type.String({ description: "应用 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch16-sidebar/index.js");
        const result = await ch.delSideBarNav(params.appId);
        return toolResult(`✅ 已删除侧栏导航\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch16-sidebar.js.map