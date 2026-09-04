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
 *   yach_get_status      — daemon 连接状态
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
// ── 薪火知识库 617lorebase CRUD 工具 ──
// ─── 薪火知识库 617lorebase 增删改查工具 ─────────────────────────────────
// 旧石墨/25doc/wiki 工具已全部删除（2026-07-20），统一走 lorebase。
// ⭐ 所有接口用 postJson（JSON body），不用 form-urlencoded。
export const yachListLoreSpaces = {
    name: "yach_list_lore_spaces",
    label: "薪火知识库列表",
    description: "列出我的薪火知识库列表（617lorebase/space/manage/list）。req_type: 1=我的知识库(默认), 2=共享给我的。只读。",
    parameters: Type.Object({
        reqType: Type.Optional(Type.Integer({ description: "1=我的知识库(默认) 2=共享给我的", default: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreManageList(params.reqType ?? 1);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 薪火知识库目录树（617lorebase/space/sidenodes） */
export const yachLoreSidenodes = {
    name: "yach_lore_sidenodes",
    label: "薪火知识库目录树",
    description: "获取薪火知识库的目录树（617lorebase/space/sidenodes）。topicId 来自 yach_list_lore_spaces。返回 topic_node（含 children 节点列表，每个节点有 key/title/type/node_open_url）。只读。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id（来自 yach_list_lore_spaces）" }),
        nodeIds: Type.Optional(Type.Array(Type.String(), { description: "定位展开指定节点（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreSidenodes(params.topicId, { nodeIds: params.nodeIds });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 在薪火知识库中新增节点/文档（617lorebase/space/node/add） */
export const yachLoreNodeAdd = {
    name: "yach_lore_node_add",
    label: "薪火知识库新增节点",
    description: "在薪火知识库中新增文档/表格/文件夹节点（617lorebase/space/node/add）。\nnodeType: doc(文档) / excel(表格/mosheet) / ppt(演示) / form(表单) / folder(文件夹)。\n返回新节点 key + shimo 在线文档 URL。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        parentNodeId: Type.Optional(Type.String({ description: "父节点 key（根目录留空则传 topicId）" })),
        nodeType: Type.String({ description: "doc / excel / ppt / form / folder", default: "doc" }),
        name: Type.Optional(Type.String({ description: "节点名称（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreNodeAdd(params.topicId, params.parentNodeId || params.topicId, params.nodeType ?? "doc", params.name ?? "");
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 重命名薪火知识库节点（617lorebase/space/node/edit/name） */
export const yachLoreNodeRename = {
    name: "yach_lore_node_rename",
    label: "薪火知识库节点重命名",
    description: "重命名薪火知识库中的文档/表格/文件夹节点（617lorebase/space/node/edit/name）。nodeId 来自 yach_lore_sidenodes 的 key 字段。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key（来自 yach_lore_sidenodes）" }),
        name: Type.String({ description: "新名称" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreNodeRename(params.topicId, params.nodeId, params.name);
        return toolResult(`✅ 已重命名节点 ${params.nodeId} → "${params.name}"`);
    },
};
/** 移动薪火知识库节点（617lorebase/space/node/drag） */
export const yachLoreNodeDrag = {
    name: "yach_lore_node_drag",
    label: "薪火知识库节点移动",
    description: "移动薪火知识库中的节点（617lorebase/space/node/drag）。nodeId 是要移动的节点 key，parentNodeId 是目标父节点（根目录传 topicId），targetNodeId 是排在哪个节点之后（空=移到最前）。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "要移动的节点 key" }),
        parentNodeId: Type.Optional(Type.String({ description: "目标父节点 key（根目录传 topicId）" })),
        targetNodeId: Type.Optional(Type.String({ description: "排在此节点之后（空=最前）" })),
        targetNodeIndex: Type.Optional(Type.Integer({ description: "目标 index", default: 0 })),
        originParentId: Type.Optional(Type.String({ description: "原父节点 id" })),
        originNodeIndex: Type.Optional(Type.Integer({ description: "原 index", default: 0 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreNodeDrag(params.topicId, params.nodeId, params.parentNodeId || params.topicId, {
            targetNodeId: params.targetNodeId || "",
            targetNodeIndex: params.targetNodeIndex ?? 0,
            originParentId: params.originParentId || params.topicId,
            originNodeIndex: params.originNodeIndex ?? 0,
        });
        return toolResult(`✅ 已移动节点 ${params.nodeId}`);
    },
};
/** 删除薪火知识库节点（617lorebase/space/node/del） */
export const yachLoreNodeDelete = {
    name: "yach_lore_node_delete",
    label: "薪火知识库节点删除",
    description: "删除薪火知识库中的节点（617lorebase/space/node/del）。all=0 仅删此节点，all=1 含子节点全删。⚠️ 不可恢复，执行前必须确认。nodeId 来自 yach_lore_sidenodes 的 key 字段。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key（来自 yach_lore_sidenodes）" }),
        all: Type.Optional(Type.Integer({ description: "0=仅此节点(默认), 1=含子节点全删", default: 0 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreNodeDelete(params.topicId, params.nodeId, params.all ?? 0);
        return toolResult(`✅ 已删除节点 ${params.nodeId}`);
    },
};
// ── 薪火知识库权限管理工具 ──────────────────────────────────────────────────
/** 知识库成员权限列表 */
export const yachLoreSpaceAuthList = {
    name: "yach_lore_space_auth_list",
    label: "薪火知识库成员权限列表",
    description: "列出薪火知识库的成员权限（617lorebase/space/auth/list）。auth: 1=可查看, 2=可编辑, 4=管理员。只读。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id（来自 yach_list_lore_spaces）" }),
        page: Type.Optional(Type.Integer({ description: "页码，默认 1", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量，默认 50", default: 50 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreSpaceAuthList(params.topicId, { page: params.page, pagesize: params.pagesize });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 添加知识库成员权限 */
export const yachLoreSpaceAuthAdd = {
    name: "yach_lore_space_auth_add",
    label: "薪火知识库添加成员",
    description: "向薪火知识库添加成员权限（617lorebase/space/auth/add）。auth: 1=可查看, 2=可编辑, 4=管理员。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        userId: Type.Integer({ description: "用户 user_id（来自 yach_search_users）" }),
        auth: Type.Integer({ description: "权限等级：1=可查看, 2=可编辑, 4=管理员", default: 1 }),
        type: Type.Optional(Type.String({ description: "成员类型：user(默认)/dept/group", default: "user" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreSpaceAuthAdd(params.topicId, params.userId, params.auth ?? 1, params.type ?? "user");
        const authMap = { 1: "可查看", 2: "可编辑", 4: "管理员" };
        const authName = authMap[params.auth ?? 1] ?? String(params.auth);
        return toolResult(`✅ 已添加用户 ${params.userId} 到知识库（${authName}）`);
    },
};
/** 修改知识库成员权限 */
export const yachLoreSpaceAuthEdit = {
    name: "yach_lore_space_auth_edit",
    label: "薪火知识库修改成员权限",
    description: "修改薪火知识库成员的权限等级（617lorebase/space/auth/edit）。auth: 1=可查看, 2=可编辑, 4=管理员。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        userId: Type.Integer({ description: "用户 user_id" }),
        auth: Type.Integer({ description: "新权限等级：1=可查看, 2=可编辑, 4=管理员" }),
        type: Type.Optional(Type.String({ description: "成员类型：user(默认)/dept/group", default: "user" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreSpaceAuthEdit(params.topicId, params.userId, params.auth, params.type ?? "user");
        const authMap = { 1: "可查看", 2: "可编辑", 4: "管理员" };
        const authName = authMap[params.auth] ?? String(params.auth);
        return toolResult(`✅ 已修改用户 ${params.userId} 权限 → ${authName}`);
    },
};
/** 删除知识库成员权限 */
export const yachLoreSpaceAuthDel = {
    name: "yach_lore_space_auth_del",
    label: "薪火知识库移除成员",
    description: "从薪火知识库移除成员权限（617lorebase/space/auth/del）。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        userId: Type.Integer({ description: "用户 user_id" }),
        type: Type.Optional(Type.String({ description: "成员类型：user(默认)/dept/group", default: "user" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreSpaceAuthDel(params.topicId, params.userId, params.type ?? "user");
        return toolResult(`✅ 已移除用户 ${params.userId} 的知识库权限`);
    },
};
/** 节点协作者列表 */
export const yachLoreNodeCollaboratorsList = {
    name: "yach_lore_node_collaborators_list",
    label: "薪火知识库节点协作者列表",
    description: "列出薪火知识库节点的协作者（617lorebase/node/content/collaborators/list）。只读。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key（来自 yach_lore_sidenodes）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreNodeCollaboratorsList(params.topicId, params.nodeId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 添加节点协作者 */
export const yachLoreNodeCollaboratorsAdd = {
    name: "yach_lore_node_collaborators_add",
    label: "薪火知识库添加节点协作者",
    description: "向薪火知识库节点添加协作者（617lorebase/node/content/collaborators/add）。auth: 1=可查看, 2=可编辑, 4=管理员。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key" }),
        userId: Type.Integer({ description: "用户 user_id" }),
        auth: Type.Integer({ description: "权限等级：1=可查看, 2=可编辑, 4=管理员", default: 1 }),
        type: Type.Optional(Type.String({ description: "成员类型：user(默认)/dept/group", default: "user" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreNodeCollaboratorsAdd(params.topicId, params.nodeId, params.userId, params.auth ?? 1, params.type ?? "user");
        return toolResult(`✅ 已添加用户 ${params.userId} 为节点 ${params.nodeId} 协作者`);
    },
};
/** 删除节点协作者 */
export const yachLoreNodeCollaboratorsDel = {
    name: "yach_lore_node_collaborators_del",
    label: "薪火知识库删除节点协作者",
    description: "从薪火知识库节点移除协作者（617lorebase/node/content/collaborators/del）。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key" }),
        userId: Type.Integer({ description: "用户 user_id" }),
        type: Type.Optional(Type.String({ description: "成员类型：user(默认)/dept/group", default: "user" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreNodeCollaboratorsDel(params.topicId, params.nodeId, params.userId, params.type ?? "user");
        return toolResult(`✅ 已移除用户 ${params.userId} 的节点协作者权限`);
    },
};
/** 修改节点协作者权限等级 */
export const yachLoreNodeCollaboratorsEdit = {
    name: "yach_lore_node_collaborators_edit",
    label: "薪火知识库修改节点协作者权限",
    description: "修改薪火知识库节点协作者的权限等级（617lorebase/node/content/collaborators/edit）。auth: 1=可查看, 2=可编辑, 4=管理员。写操作，执行前需用户确认。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key" }),
        userId: Type.Integer({ description: "用户 user_id" }),
        auth: Type.Integer({ description: "权限等级：1=可查看, 2=可编辑, 4=管理员" }),
        type: Type.Optional(Type.String({ description: "成员类型：user(默认)/dept/group", default: "user" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.loreNodeCollaboratorsEdit(params.topicId, params.nodeId, params.userId, params.auth, params.type ?? "user");
        const authLabel = params.auth === 1 ? "可查看" : params.auth === 2 ? "可编辑" : params.auth === 4 ? "管理员" : params.auth;
        return toolResult(`✅ 已修改用户 ${params.userId} 的节点协作者权限为：${authLabel}`);
    },
};
/** 节点分享配置（可选范围） */
export const yachLoreNodeShareGetConf = {
    name: "yach_lore_node_share_get_conf",
    label: "薪火知识库节点分享配置",
    description: "获取薪火知识库节点的分享配置选项（617lorebase/node/share/get_conf）。返回可选 range_key：0=仅部分人可见, 1=企业内公开。只读。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreNodeShareGetConf(params.topicId, params.nodeId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 节点当前分享状态 */
export const yachLoreNodeShareGetContentConf = {
    name: "yach_lore_node_share_get_content_conf",
    label: "薪火知识库节点当前分享状态",
    description: "获取薪火知识库节点当前的分享状态（617lorebase/node/share/get_content_conf）。返回 {range_key, range_auth_key}。只读。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreNodeShareGetContentConf(params.topicId, params.nodeId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 设置节点分享状态 */
export const yachLoreNodeShareSetContentConf = {
    name: "yach_lore_node_share_set_content_conf",
    label: "设置薪火文档分享状态",
    description: "按文档 guid 设置薪火文档分享范围（617lorebase/node/share/set_content_conf）。rangeKey 通常 0=部分人、1=企业内；属于权限写操作，执行前需用户确认。",
    parameters: Type.Object({
        guid: Type.String({ description: "文档 guid / 节点 key" }),
        rangeKey: Type.Integer({ description: "分享范围 key，通常 0=部分人、1=企业内" }),
        rangeAuthKey: Type.Integer({ description: "分享权限 key，以 get_content_conf/get_conf 返回值为准" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const value = await ch5.loreNodeShareSetContentConf(params.guid, params.rangeKey, params.rangeAuthKey);
        return toolResult(`✅ 分享状态已更新\n${JSON.stringify(value, null, 2)}`);
    },
};
/** 通过新版 625doc 接口新建普通文档/文件夹 */
export const yachCreateClientDocument = {
    name: "yach_create_client_document",
    label: "新建知音楼文档",
    description: "通过 625doc/lore/doc/create 新建普通文档或文件夹。与薪火知识库 topic 节点创建不同；写操作，执行前需用户确认。",
    parameters: Type.Object({
        name: Type.String({ minLength: 1, description: "文档或文件夹名称" }),
        type: Type.Optional(Type.Union([Type.Literal("newdoc"), Type.Literal("folder")], { default: "newdoc" })),
        parentGuid: Type.Optional(Type.String({ description: "父文件夹 guid；根目录可不传" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const value = await ch5.createClientDocument(params.name, params.type ?? "newdoc", params.parentGuid);
        return toolResult(`✅ 已创建${params.type === "folder" ? "文件夹" : "文档"}\n${JSON.stringify(value, null, 2)}`);
    },
};
/** 节点安全权限列表 */
export const yachLoreNodeSecurityList = {
    name: "yach_lore_node_security_list",
    label: "薪火知识库节点安全权限列表",
    description: "获取薪火知识库节点的安全权限列表（617lorebase/node/security/list）。只读。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreNodeSecurityList(params.topicId, params.nodeId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 节点详情 */
export const yachLoreNodeInfo = {
    name: "yach_lore_node_info",
    label: "薪火知识库节点详情",
    description: "获取薪火知识库节点的完整详情（617lorebase/space/node/info），含标题/类型/父节点/文档 URL/权限等。只读。",
    parameters: Type.Object({
        topicId: Type.String({ description: "知识库 topic_id" }),
        nodeId: Type.String({ description: "节点 key" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreNodeInfo(params.topicId, params.nodeId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 上传本地文件到知识库 folder（sign→COS→save，真调打通 2026-07-20）*/
export const yachLoreUploadFile = {
    name: "yach_lore_upload_file",
    label: "上传文件到薪火知识库",
    description: "把本地文件上传到薪火知识库指定文件夹（sign→COS putObject→save 三段链路，真调打通）。⭐ folderGuid 必须传短 guid（如 KrkEVQO2m0izprAJ，来自节点 node_open_url 里的 /folder/<guid>），不是数字 node_id。写操作，执行前需用户确认。",
    parameters: Type.Object({
        folderGuid: Type.String({ description: "目标文件夹短 guid（非数字 node_id）" }),
        filePath: Type.String({ description: "本地文件绝对路径" }),
        fileName: Type.Optional(Type.String({ description: "上传后文件名（默认取 filePath 的 basename）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const result = await ch5.loreUploadFile(params.folderGuid, params.filePath, { fileName: params.fileName });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** 读取薪火知识库文档正文（Markdown），HTTP/2 + 25doc SSO，2026-07-21 真调通 */
export const yachLoreReadDoc = {
    name: "yach_lore_read_doc",
    label: "读取薪火知识库文档正文",
    description: "⭐ 读取薪火知识库文档正文。guid 可直接传文档 guid、完整 Shimo 文档 URL 或 s.tal.com 短链；含图片且 r2m 不支持时自动读取 contentUrl 原始正文并转换。只读。",
    parameters: Type.Object({
        guid: Type.String({ description: "文档 guid、完整 Shimo 文档 URL 或 https://s.tal.com/... 短链" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const content = await ch5.readDocMarkdown(params.guid);
        return toolResult(content);
    },
};
/** 写入薪火知识库文档正文（Markdown 替换全文），HTTP/2 + 25doc SSO，2026-07-21 真调通 */
export const yachLoreWriteDoc = {
    name: "yach_lore_write_doc",
    label: "写入薪火知识库文档正文",
    description: "⭐ 写入薪火知识库文档的 Markdown 正文（替换全文内容）。guid 从节点 node_open_url 的 /docs/{guid} 路径提取。底层走 yach-doc-shimo.zhiyinlou.com/sdk/v2/api（HTTP/2）。写操作，执行前需用户确认。",
    parameters: Type.Object({
        guid: Type.String({ description: "文档 guid（来自 node_open_url /docs/{guid}）" }),
        content: Type.String({ description: "新 Markdown 内容（替换全文）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        await ch5.writeDocMarkdown(params.guid, params.content);
        return toolResult(`✅ 文档 ${params.guid} 内容已更新（${params.content.length} 字符）`);
    },
};
/** ch7 - ⭐ 周报已读人列表（真调验证：字段 name/workCode/at，2026-07-13）*/
//# sourceMappingURL=ch5-docs.js.map