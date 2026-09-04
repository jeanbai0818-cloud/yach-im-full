/**
 * 知音楼 Agent 工具集
 *
 * 工具通过 OpenClaw/知音楼服务端能力查询数据，
 * 或者直接调用 ch1-messaging 发消息。
 *
 * 工具列表：
 *   yach_send_message    — 发消息（文本/图片/文件/音视频/图文混排）
 *   yach_get_history     — 查某会话历史消息
 *   yach_list_sessions   — 列出所有会话
 *   yach_search_messages — 全文搜索消息
 *   yach_get_status      — yach-im-full NIM 连接状态
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
// ── 工具工厂 ─────────────────────────────────────────────────
/**
 * 发消息
 * 文本直接传 text；媒体消息传本地文件绝对路径。
 */
export const yachSearchUsers = {
    name: "yach_search_users",
    label: "搜索知音楼用户",
    description: "搜索知音楼用户（按姓名/工号），返回 user_id、姓名、部门",
    parameters: Type.Object({
        query: Type.String({ description: "搜索关键词（姓名或工号）" }),
        limit: Type.Optional(Type.Integer({ description: "返回数量上限，默认 20", default: 20, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const result = await ch9.searchUser(params.query, { pagesize: params.limit ?? 20 });
        const users = Array.isArray(result?.list) ? result.list : [];
        if (!users.length)
            return toolResult(`未找到用户：${params.query}`);
        const lines = users.map((user) => `${user.name || user.name_nick || "未知姓名"} | user.id=${user.id} | 工号=${user.work_code || user.workCode || "?"} | 部门=${user.dept_name || user.deptName || "?"}`);
        return toolResult(`共找到 ${result.total ?? users.length} 人。发送消息时只能使用每行明确标注的 user.id，` +
            `不要使用 frequent_contact 等嵌套关系字段。\n\n${lines.join("\n")}`);
    },
};
/**
 * ch3 - 列出知音楼内置 AI 机器人
 */
export const yachGetUserCard = {
    name: "yach_get_user_card",
    label: "用户名片",
    description: "获取某人的完整个人名片（知音楼点头像弹出的数据）：邮箱/职位/职级/部门/汇报对象/工位/忙闲状态/价值观标签，" +
        "以及 OKR/周报/成长/工卡等链接。userId 省略时读取当前登录 session 的本人 user.id；" +
        "查他人时用 yach_search_users 获取 user_id。常用于发邮件或按工位选择会议室。只读。",
    parameters: Type.Object({
        userId: Type.Optional(Type.Integer({ description: "用户 user.id；省略则查询当前登录用户本人" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const org = require("../../api/ch9-org/index.js");
        const c = await org.getUserCard(params.userId);
        const lines = [
            `${c.name}${c.nameEn ? " (" + c.nameEn + ")" : ""} | 工号 ${c.workCode}`,
            `职位: ${c.position} | 职级: ${c.level} | ${c.empType}`,
            `邮箱: ${c.email}`,
            c.mobile ? `手机: ${c.mobile}` : "",
            `部门: ${c.deptFullName}`,
            c.reportsTo ? `汇报对象: ${c.reportsTo}${c.isManager ? " | 本人是管理者" : ""}` : "",
            c.workState ? `当前状态: ${c.workEmoji}${c.workState}` : "",
            c.valuesTag ? `价值观标签: ${c.valuesTag}` : "",
            c.officeAddr || c.station
                ? `${c.officeAddr ? "办公地: " + c.officeAddr : ""}${c.officeAddr && c.station ? " | " : ""}${c.station ? "工位: " + c.station : ""}`
                : "",
            c.entryDate ? `入职: ${c.entryDate}` : "",
            c.okrUrl ? `OKR: ${c.okrUrl}` : "",
            c.weeklyUrl ? `周报: ${c.weeklyUrl}` : "",
            c.workCardUrl ? `电子工卡: ${c.workCardUrl}` : "",
        ].filter(Boolean);
        return toolResult(lines.join("\n"));
    },
};
/** ch5 - 列邮箱文件夹（真调，网易企业邮）*/
export const yachListDepts = {
    name: "yach_list_depts",
    label: "查知音楼组织架构",
    description: "查询某部门的下级部门列表（组织架构树）。parentDeptId 不传则查顶级。",
    parameters: Type.Object({
        parentDeptId: Type.Optional(Type.String({ description: "父部门 id，不传或 0 = 顶级" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const r = await ch9.getSubDepts(params.parentDeptId ?? "0");
        const root = r.root || {};
        const mgr = root.manager ? `${root.manager.name}(${root.manager.id})` : "(无)";
        const path = Array.isArray(root.full) ? root.full.map((x) => x.og_name).join(" / ") : "";
        const subs = (r.ogList || []).map((d) => `• ${d.deptName}（id=${d.deptId}，${d.userNum || 0}人${d.hasSubOg ? "，有下级" : ""}）`);
        const users = (r.userList || []).map((u) => `${u.name || u.user_name}(${u.work_code || u.id})`);
        const lines = [
            path ? `路径: ${path}` : "",
            `负责人: ${mgr}`,
            `下级部门 ${subs.length} 个:`,
            ...subs,
            users.length ? `\n本部门直属成员 ${users.length} 人: ${users.slice(0, 30).join(", ")}` : "",
        ].filter(Boolean);
        return toolResult(lines.join("\n"));
    },
};
/**
 * ch5 - 搜索文档
 */
export const yachGetOrgUsers = {
    name: "yach_get_org_users",
    label: "知音楼部门用户列表",
    description: "获取指定部门的成员列表（组织架构）。departmentId 从 yach_list_depts 获取。只读。",
    parameters: Type.Object({
        departmentId: Type.String({ description: "部门 ID（从 yach_list_depts 获取）" }),
        limit: Type.Optional(Type.Integer({ description: "每页数量，默认 50", default: 50, minimum: 1, maximum: 200 })),
        page: Type.Optional(Type.Integer({ description: "页码，默认 1", default: 1, minimum: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const result = await ch9.getOrgUsers(params.departmentId, params.page ?? 1, params.limit ?? 50);
        const list = Array.isArray(result) ? result : (result?.list ?? result?.users ?? []);
        if (!list.length)
            return toolResult("该部门暂无成员");
        const lines = list.map((u) => `👤 ${u.name ?? ""}（${u.work_code ?? u.workCode ?? ""}）ID:${u.id ?? u.user_id ?? ""} ${u.dept_name ?? u.deptName ?? ""}`);
        return toolResult(`共 ${list.length} 人：\n\n${lines.join("\n")}`);
    },
};
/**
 * ch6 - 全局搜索
 */
export const yachSetUserInfo = {
    name: "yach_set_user_info",
    label: "设置个人状态",
    description: "更新个人资料（ucenter/user/info/save）：状态文字、签名或已上传的知音楼 CDN 头像 URL。写操作，执行前需用户确认。",
    parameters: Type.Object({
        status: Type.Optional(Type.String({ description: "状态文字（如 '开会中' '请假'）" })),
        signature: Type.Optional(Type.String({ description: "个性签名" })),
        pic: Type.Optional(Type.String({ description: "头像 URL；仅允许 https://yach-static.zhiyinlou.com 域名" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const fields = {};
        if (params.status != null)
            fields.status = params.status;
        if (params.signature != null)
            fields.signature = params.signature;
        if (params.pic != null)
            fields.pic = params.pic;
        if (!Object.keys(fields).length)
            return toolResult("⚠️ 未传任何字段，无修改。");
        await ch9.setUserInfo(fields);
        return toolResult(`✅ 已更新个人信息：${JSON.stringify(fields)}`);
    },
};
/** ch5 - ⭐ 在知识库建文件（写操作，需确认）*/
/** ⭐ 按 user_id 批量查用户基础信息（头像/姓名/uuid，2026-07-14）*/
export const yachGetUsersByIdList = {
    name: "yach_get_users_by_id_list",
    label: "批量查用户信息",
    description: "按 user_id 数组批量查用户基础信息（头像/姓名/uuid）。比逐个查更高效。只读。",
    parameters: Type.Object({
        userIds: Type.Array(Type.Union([Type.String(), Type.Integer()]), {
            description: "user_id 数组（数字或字符串均可）",
        }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const list = await ch9.getUsersByIdList(params.userIds);
        if (!list.length)
            return toolResult("未找到对应用户");
        const lines = list.map((u) => `👤 ${u.name ?? ""}（${u.name_en ?? ""}）ID:${u.id} uuid:${u.uuid ?? ""}`);
        return toolResult(`共 ${list.length} 人：\n\n${lines.join("\n")}`);
    },
};
/** ⭐ 获取平台配置元信息（敏感密钥只返回存在性，2026-07-14）*/
export const yachGetPlatformConfig = {
    name: "yach_get_platform_config",
    label: "获取平台配置",
    description: "获取平台动态配置元信息。敏感的 decr_config_key 只返回是否存在，不返回密钥值；该工具需要显式启用。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const result = await ch9.getPlatformConfig();
        const lines = [
            result.decrConfigKey ? "✅ decrConfigKey: [已脱敏，已配置]" : "⚠️ decrConfigKey 未找到",
            `原始配置 key 数量: ${Object.keys(result.rawConfig).length}`,
        ];
        return toolResult(lines.join("\n"));
    },
};
/** ⭐ 用户个人配置（AI助手、搜索布局等，2026-07-14）*/
export const yachGetUserConfig = {
    name: "yach_get_user_config",
    label: "获取用户个人配置",
    description: "获取用户个人偏好配置（AI助手信息、搜索Tab布局、会议通知开关等）。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const cfg = await ch9.getUserConfig();
        const lines = [];
        if (cfg.interlloft) {
            lines.push(`🤖 AI助手: ${cfg.interlloft.robot_name ?? ""}（uid:${cfg.interlloft.robot_uid ?? ""}）`);
            lines.push(`   显示主界面: ${cfg.interlloft.is_show_main ? "是" : "否"}`);
        }
        if (cfg.meeting_notice_switch !== undefined) {
            lines.push(`📅 会议通知: ${cfg.meeting_notice_switch || "默认"}`);
        }
        if (cfg.record_switch !== undefined) {
            lines.push(`🎙 录音开关: ${cfg.record_switch ? "开" : "关"}`);
        }
        if (Array.isArray(cfg.search_first_tab_conf)) {
            const tabs = cfg.search_first_tab_conf.map((t) => t.name?.zh ?? t.type).join(" / ");
            lines.push(`🔍 搜索Tab: ${tabs}`);
        }
        if (!lines.length)
            lines.push(JSON.stringify(cfg).slice(0, 300));
        return toolResult(lines.join("\n"));
    },
};
/** ⭐ 企业价值观标签列表（2026-07-14）*/
export const yachGetValueTags = {
    name: "yach_get_value_tags",
    label: "获取价值观标签",
    description: "获取企业价值观标签列表（名片标签、OKR标签用）。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const { defaultTagName, tags } = await ch9.getValueTags();
        if (!tags.length)
            return toolResult("暂无价值观标签");
        const lines = tags.map((t) => `🏷 ${t.name}（${t.nameEn}）id:${t.id}`);
        return toolResult(`默认标语：${defaultTagName}\n\n${lines.join("\n")}`);
    },
};
/** ⭐ 未来人新帖数（2026-07-14）*/
export const yachGetYoungNewPost = {
    name: "yach_get_young_new_post",
    label: "未来人新帖数",
    description: "查询未来人（Young）社区未读新帖数量。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const { newPostCount } = await ch9.getYoungNewPost();
        return toolResult(newPostCount > 0 ? `📰 未来人有 ${newPostCount} 篇新帖` : "📰 暂无未来人新帖");
    },
};
/** ⭐ 工作状态列表（2026-07-21）*/
export const yachListWorkstates = {
    name: "yach_list_workstates",
    label: "列出工作状态",
    description: "列出知音楼\"我的状态\"面板中的所有工作状态（请假/出差/会议/专注等）。" +
        "含当前激活状态（isActive=true）、自动回复内容。" +
        "激活状态用 yach_set_workstate 切换。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const states = await ch9.listWorkstates();
        if (!states.length)
            return toolResult("暂无工作状态");
        const lines = states.map((s) => {
            const active = s.isActive ? " ✅ [当前]" : "";
            const custom = s.isCustom ? " (自定义)" : "";
            const reply = s.autoReply && s.autoReplyText ? `\n  ↩ 自动回复: ${s.autoReplyText}` : "";
            return `${s.emoji} ${s.content || "(空)"}${active}${custom}  id:${s.id}${reply}`;
        });
        const active = states.find((s) => s.isActive);
        const header = active ? `当前状态: ${active.emoji} ${active.content || "(空)"}` : "当前无激活状态";
        return toolResult(`${header}\n\n所有状态（共 ${states.length} 个）:\n${lines.join("\n")}`);
    },
};
/** ⭐ 激活工作状态（2026-07-21，写操作）*/
export const yachSetWorkstate = {
    name: "yach_set_workstate",
    label: "切换工作状态",
    description: "激活知音楼工作状态（如\"请假中\"/\"会议中\"/\"专注一下\"）。" +
        "id 从 yach_list_workstates 获取。写操作，会真实改变你在他人消息页/名片上显示的状态。",
    parameters: Type.Object({
        id: Type.String({ description: "工作状态 id（来自 yach_list_workstates 的 id 字段）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        await ch9.setWorkstate(params.id);
        // 回读当前激活状态确认
        const states = await ch9.listWorkstates();
        const active = states.find((s) => s.isActive);
        return toolResult(active
            ? `✅ 工作状态已切换为: ${active.emoji} ${active.content || "(空)"}`
            : "✅ 工作状态已更新");
    },
};
/** ch9 - 联系人/群组列表（服务端，2026-07-21）*/
export const yachListContacts = {
    name: "yach_list_contacts",
    label: "联系人列表",
    description: "获取服务端联系人/群组列表（94capi/ucenter/user/connect/list）。" +
        "含外部联系人标记（external_flag）、连接日期（connect_date）。" +
        "与 yach_list_sessions（当前连接内存摘要）不同：此接口来自服务端，更完整。只读。",
    parameters: Type.Object({
        limit: Type.Optional(Type.Number({ description: "返回上限，默认 100", maximum: 200, minimum: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const result = await ch9.listContacts({ size: params.limit ?? 100 });
        const list = result.list || [];
        if (!list.length)
            return toolResult("联系人列表为空");
        const users = list.filter((c) => !c.external_flag && c.type !== 1);
        const teams = list.filter((c) => c.type === 1);
        const external = list.filter((c) => c.external_flag);
        const lines = [`共 ${list.length} 个联系人/群组：`];
        if (teams.length) {
            lines.push(`👥 群组（${teams.length}）：`);
            for (const t of teams.slice(0, 10))
                lines.push(`  • [${t.id}] ${t.name}`);
            if (teams.length > 10)
                lines.push(`  ...还有 ${teams.length - 10} 个`);
        }
        if (users.length) {
            lines.push(`👤 用户（${users.length}）：`);
            for (const u of users.slice(0, 10)) {
                const ext = u.external_flag ? " [外部]" : "";
                lines.push(`  • [${u.id}] ${u.name} (${u.dept_name || "?"})${ext}`);
            }
            if (users.length > 10)
                lines.push(`  ...还有 ${users.length - 10} 个`);
        }
        return toolResult(lines.join("\n"));
    },
};
/** ch9 - 获取工作状态详情（bsvr/workstate/info）*/
export const yachGetWorkstateInfo = {
    name: "yach_get_workstate_info",
    label: "获取工作状态详情",
    description: "获取指定工作状态的完整详情：emoji/正文/自动回复内容/开始结束时间/是否激活等。" +
        "接口：POST bsvr/workstate/info {wuc_id}（2026-07-21 真调验证）。" +
        "wucId 从 yach_list_workstates 的 id 字段获取。只读。",
    parameters: Type.Object({
        wucId: Type.String({ description: "工作状态 id（来自 yach_list_workstates 的 id 字段）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch9 = require("../../api/ch9-org/index.js");
        const info = await ch9.getWorkstateInfo(params.wucId);
        const lines = [];
        lines.push(`状态：${info.emoji || ""} ${info.content || "（未设置）"}`);
        lines.push(`wuc_id: ${info.wuc_id} | 类型: ${info.custom ? "自定义" : "系统"} | 激活: ${info.checked ? "✅" : "❌"}`);
        if (info.start_time && info.start_time !== "0") {
            const t = new Date(Number(info.start_time) * 1000).toLocaleString("zh-CN");
            lines.push(`开始: ${t}`);
        }
        if (info.end_time && info.end_time !== "0") {
            const t = new Date(Number(info.end_time) * 1000).toLocaleString("zh-CN");
            lines.push(`结束: ${t}`);
        }
        if (info.time_diff_str)
            lines.push(`预计时长: ${info.time_diff_str} 分钟`);
        const replyInfos = info.auto_reply_info || [];
        if (replyInfos.length) {
            lines.push(`\n自动回复（${replyInfos.length} 条）：`);
            for (const r of replyInfos) {
                const content = r.content?.reply_content || "";
                const active = r.checked ? "✅激活" : "❌未激活";
                lines.push(`  ${active}: ${content.slice(0, 80)}`);
            }
        }
        else {
            lines.push("无自动回复");
        }
        if (info.remark)
            lines.push(`备注: ${info.remark}`);
        return toolResult(lines.join("\n"));
    },
};
//# sourceMappingURL=ch9-org.js.map
