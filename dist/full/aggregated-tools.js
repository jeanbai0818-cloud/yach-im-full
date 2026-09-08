import { Type } from "typebox";
import * as legacyModule from "./yach-im-full/plugin/tools/index.js";

const legacyTools = Object.values(legacyModule).filter((value) => value &&
    typeof value === "object" &&
    typeof value.name === "string" &&
    typeof value.execute === "function");
const legacyToolsByName = new Map(legacyTools.map((tool) => [tool.name, tool]));

const AGGREGATES = [
    ["yach_private_chat", "messaging", "私聊消息", "发送或撤回知音楼私聊消息。"],
    ["yach_group_chat", "messaging", "群聊消息", "发送群文本、@消息、卡片、投票或机器人消息。"],
    ["yach_message_history", "messaging", "消息历史", "查询私聊或群聊的 NIM 云端历史消息；支持按 userId、sessionId、groupTid 或 groupName 选择会话，按最近 N 条、时间范围、发送者身份筛选，并通过 nextCursor 继续分页。"],
    ["yach_message_search", "messaging", "消息搜索", "搜索知音楼消息和敏感消息。"],
    ["yach_conversations", "messaging", "会话管理", "查询会话、未读和会话置顶配置。"],
    ["yach_connection_status", "messaging", "连接状态", "查询 yach-im-full 的 NIM 连接状态。"],
    ["yach_group_admin", "groups", "群组管理", "创建、修改、成员管理、禁言、退出或解散群组。"],
    ["yach_group_directory", "groups", "群组查询", "搜索群组并查询群组、成员和群组摘要。"],
    ["yach_group_content", "groups", "群组内容", "处理群公告、群表情、讨论组和投票。"],
    ["yach_group_applications", "groups", "入群申请", "查询和处理群组申请。"],
    ["yach_people", "groups", "组织人员", "搜索人员、部门、名片、联系人和工作状态。"],
    ["yach_external_contacts", "groups", "外部联系人", "查询和管理外部联系人及外部申请。"],
    ["yach_mail", "mail", "企业邮件", "查询、阅读、发送和撤回企业邮件。"],
    ["yach_calendar", "calendar", "日程", "查询、创建、修改、删除和响应日程。"],
    ["yach_meetings", "calendar", "会议", "会议室和腾讯会议查询、预订及会议记录。"],
    ["yach_files", "files", "文件", "查询、上传、移动、重命名、分享和删除文件。"],
    ["yach_documents", "files", "文档", "创建、读取、转换和管理企业文档。"],
    ["yach_knowledge", "files", "知识库", "查询和编辑知识库空间、节点和文档。"],
    ["yach_shortcuts", "files", "快捷方式", "管理知音楼快捷方式和收藏。"],
    ["yach_work_weekly", "work", "周报", "查询、编辑、提交和互动周报。"],
    ["yach_work_okr", "work", "OKR", "查询 OKR、模板和详情。"],
    ["yach_work_attendance", "work", "考勤", "查询和执行考勤操作。"],
    ["yach_reminders", "notifications", "提醒", "查询、发送、确认和撤回提醒。"],
    ["yach_notifications", "notifications", "通知", "查询通知、推送和信息治理配置。"],
    ["yach_links", "notifications", "链接工具", "链接预览、摘要、短链接和安全检查。"],
    ["yach_ai_assistant", "ai", "AI 助手", "AI 机器人、提示词、助手历史和 AI 媒体能力。"],
    ["yach_intelloft_chat", "ai", "Intelloft 会话", "Intelloft 会话、消息和对话操作。"],
    ["yach_intelloft_skills", "ai", "Intelloft 技能", "Intelloft 技能查询、安装、分享和管理。"],
    ["yach_intelloft_tools", "ai", "Intelloft 工具", "Intelloft OCR、转换、选项、反馈和通知。"],
    ["yach_platform", "platform", "开放平台", "机器人、OAPI、平台配置和工作台能力。"],
].map(([name, pack, label, description]) => ({ name, pack, label, description }));

const aggregateByName = new Map(AGGREGATES.map((entry) => [entry.name, entry]));

function matches(name, pattern) {
    return pattern.test(name);
}

/**
 * Keep classification explicit and ordered. The mapping is intentionally
 * derived from the legacy names so the old implementation remains the source
 * of execution behavior while the aggregate registry becomes the public API.
 */
function classifyLegacyTool(name) {
    if (name === "yach_get_status") return "yach_connection_status";
    if (matches(name, /^yach_(?:send_message|recall_message)$/u)) return "yach_private_chat";
    if (matches(name, /^yach_(?:send_group_text|send_at_message|send_card|send_vote|send_robot_message)$/u)) return "yach_group_chat";
    if (matches(name, /^yach_(?:get_history|get_message_highlights)$/u)) return "yach_message_history";
    if (matches(name, /^yach_(?:search_messages|query_sensitive_msgs|global_search)$/u)) return "yach_message_search";
    if (matches(name, /^yach_(?:list_sessions|get_top_sessions|get_session_top_config|get_session_top_list|add_session_top|remove_session_top|set_session_top_config|sort_session_top|add_side_bar_nav|del_side_bar_nav|get_side_bar_conf|set_side_bar_conf|get_group_unread)$/u)) return "yach_conversations";

    if (matches(name, /^yach_(?:create|update|delete|set)_group_announcement/u)) return "yach_group_content";
    if (matches(name, /^yach_(?:accept|batch|handle|ignore|reject)_group_apply$/u) ||
        matches(name, /^yach_(?:get_group_apply|group_apply)/u)) return "yach_group_applications";
    if (matches(name, /^yach_(?:create|dismiss|edit_group|add_group_users|remove_group_users|change_group_owner|set_group_admin|mute_group|quit_group)/u)) return "yach_group_admin";
    if (matches(name, /^yach_(?:search_groups|get_group_info|get_group_users|list_squads)$/u)) return "yach_group_directory";
    if (matches(name, /^yach_(?:group_announcement|get_group_announcement|add_group_emot|get_group_emot|discuss|get_discuss|vote|get_vote|add_vote_choice|add_user_to_discussion|join_discuss_group|set_discuss_group_title|dismiss_discuss_group)/u)) return "yach_group_content";

    if (matches(name, /^yach_(?:(?:add|delete)_external_contact|external_contact|external_apply|get_external_apply_status|list_external_contacts|list_my_external_apps|handle_external_apply)/u)) return "yach_external_contacts";
    if (matches(name, /^yach_(?:search_users|list_depts|get_org_users|get_users_by_id_list|list_contacts|get_user_card|get_user_config|set_user_info|get_workstate_info|list_workstates|set_workstate|get_avatar_info|upload_avatar)$/u)) return "yach_people";

    if (matches(name, /^yach_.*mail/u)) return "yach_mail";

    if (matches(name, /^yach_(?:schedule|list_schedules|recommend_freetime|check_schedule_conflict|timezone|support_timezone|get_support_timezone|get_timezone_list|(?:save|delete)_timezone|sync_schedule_share|add_schedule_share|cancel_schedule_share|delete_schedule_share|edit_schedule_share|list_schedule_share|respond_to_schedule|create_schedule|update_schedule|delete_schedule|get_schedule)/u)) return "yach_calendar";
    if (matches(name, /^yach_(?:book_meeting_room|cancel_meeting_room|get_meeting_room_entry|meeting_room_bookings|search_meeting_rooms|tencent_meeting|get_tencent_|refresh_tencent_token)/u)) return "yach_meetings";

    if (matches(name, /^yach_(?:batch_move_file|batch_get_file_info|check_file_expire|get_file_info|file_|create_folder|delete_folder|rename_file|delete_file|delete_user_db_upload|upload_file|share_file|save_to_recycle_bin|delete_recycle_bin_file|get_recycle_bin_list|preview_file)/u)) return "yach_files";
    if (name === "yach_create_client_document" || matches(name, /^yach_(?:convert_intelloft_file|intelloft_convert_progress)$/u)) return "yach_documents";
    if (matches(name, /^yach_(?:lore_|list_lore)/u)) return "yach_knowledge";
    if (matches(name, /^yach_(?:(?:get_|list_|upload_|update_|delete_)?shorthand|add_collect|del_collect|get_share_to_me_shorthand)/u)) return "yach_shortcuts";

    if (matches(name, /^yach_(?:.*weekly|list_report_)/u)) return "yach_work_weekly";
    if (matches(name, /^yach_.*okr/u)) return "yach_work_okr";
    if (matches(name, /^yach_(?:.*attendance|punch_)/u)) return "yach_work_attendance";

    if (matches(name, /^yach_.*remind/u)) return "yach_reminders";
    if (matches(name, /^yach_(?:get_notice|app_push|get_app_push_state|set_app_push|sensitive_words|get_sensitive_words|set_collection_remind)/u)) return "yach_notifications";
    if (matches(name, /^yach_(?:fetch_link_preview|link_msg_abstract|short_link|check_url_safety)/u)) return "yach_links";

    if (matches(name, /^yach_(?:intelloft_image_ocr|intelloft_convert_progress|intelloft_vote|change_intelloft_option|feedback_intelloft|add_live_subtitle|feedback_sdk_create)/u)) return "yach_intelloft_tools";
    if (matches(name, /^yach_(?:aiseek|ask_intelloft)/u)) return "yach_intelloft_chat";
    if (matches(name, /^yach_.*intelloft.*(?:agent_skill|skill_detail|skills|digital_partners|helpwrite|quick_agent|version_history|user_guide)/u)) return "yach_intelloft_skills";
    if (matches(name, /^yach_(?:create|delete|get|list|rename|top|continue|stop|regenerate|read|send|ask|aiseek|search_intelloft)/u) && name.includes("intelloft")) return "yach_intelloft_chat";

    if (matches(name, /^yach_(?:ai_|aide_|audio_to_text|add_prompt|del_prompt|get_prompt|edit_prompt|list_prompts|search_assistant|list_aide_bots|list_ai_|search_ai_|create_agent_robot|delete_agent_robot|get_young_new_post|list_lives|get_downvote_tags|get_value_tags)/u)) return "yach_ai_assistant";
    if (matches(name, /^yach_(?:oapi_|get_oapi|platform_|get_platform|check_robot_name|list_workbench_apps)/u)) return "yach_platform";

    throw new Error(`Unclassified legacy Yach tool: ${name}`);
}

function actionForLegacyName(name) {
    return name.replace(/^yach_/u, "");
}

const legacyToolMapping = {};
for (const legacyTool of legacyTools) {
    const aggregateName = classifyLegacyTool(legacyTool.name);
    const aggregate = aggregateByName.get(aggregateName);
    if (!aggregate)
        throw new Error(`Missing aggregate definition for ${aggregateName}`);
    legacyToolMapping[legacyTool.name] = {
        legacyName: legacyTool.name,
        aggregateName,
        pack: aggregate.pack,
        action: actionForLegacyName(legacyTool.name),
        parameterAdapter: "strip_action_identity",
    };
}

function makeBranch(entry) {
    const legacy = legacyToolsByName.get(entry.legacyName);
    const legacyParameters = legacy?.parameters ?? Type.Object({});
    return Type.Intersect([
        Type.Object({ action: Type.Literal(entry.action) }),
        legacyParameters,
    ]);
}

function normalizeResult(result, metadata) {
    const sourceDetails = result && typeof result === "object" && result.details && typeof result.details === "object"
        ? result.details
        : {};
    const serverResult = result && typeof result === "object" && result.details !== undefined
        ? result.details
        : result ?? null;
    const resourceIds = {};
    for (const key of [
        "id", "resourceId", "resourceIds", "messageId", "msgId", "sessionId", "groupId",
        "userId", "fileId", "documentId", "nodeId", "scheduleId", "mailId", "meetingId",
    ]) {
        if (serverResult && typeof serverResult === "object" && serverResult[key] !== undefined)
            resourceIds[key] = serverResult[key];
    }
    const warnings = Array.isArray(result?.warnings)
        ? result.warnings
        : Array.isArray(sourceDetails.warnings) ? sourceDetails.warnings : [];
    const unifiedDetails = {
        ...sourceDetails,
        operation: metadata.operation,
        resourceIds,
        warnings,
        serverResult,
        yach: metadata,
    };
    if (result && typeof result === "object" && Array.isArray(result.content)) {
        return {
            ...result,
            details: unifiedDetails,
        };
    }
    return {
        content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result ?? null, null, 2) }],
        details: unifiedDetails,
    };
}

function adaptLegacyParameters(entry, params) {
    // All current legacy descriptors already use the public parameter names;
    // the only envelope field introduced by aggregation is `action`.
    const legacyParams = { ...(params ?? {}) };
    delete legacyParams.action;
    return legacyParams;
}

function createAggregateTool(aggregate, entries) {
    const actions = new Map(entries.map((entry) => [entry.action, entry]));
    const branches = entries.map(makeBranch);
    return {
        name: aggregate.name,
        label: aggregate.label,
        description: `${aggregate.description} action 使用旧能力名去掉 yach_ 前缀；所有写操作仍需确认。`,
        parameters: branches.length === 1 ? branches[0] : Type.Union(branches),
        yachPack: aggregate.pack,
        yachActions: Object.fromEntries(entries.map((entry) => [entry.action, entry.legacyName])),
        async execute(toolCallId, params, signal, onUpdate, toolContext) {
            const entry = actions.get(params?.action);
            if (!entry)
                throw new Error(`不支持的 ${aggregate.name} action: ${String(params?.action)}`);
            const legacy = legacyToolsByName.get(entry.legacyName);
            if (!legacy)
                throw new Error(`Legacy tool not found: ${entry.legacyName}`);
            const legacyParams = adaptLegacyParameters(entry, params);
            const result = await legacy.execute(toolCallId, legacyParams, signal, onUpdate, toolContext);
            return normalizeResult(result, {
                aggregateTool: aggregate.name,
                action: entry.action,
                legacyTool: entry.legacyName,
                pack: aggregate.pack,
                operation: `${aggregate.name}.${entry.action}`,
            });
        },
    };
}

export const aggregatedTools = AGGREGATES.map((aggregate) => {
    const entries = Object.values(legacyToolMapping).filter((entry) => entry.aggregateName === aggregate.name);
    return createAggregateTool(aggregate, entries);
});

export const aggregateToolNames = aggregatedTools.map((tool) => tool.name);
export const aggregateToolPacks = Object.fromEntries(AGGREGATES.map((entry) => [entry.name, entry.pack]));
export { legacyToolMapping, legacyTools };

export function resolveEnabledYachPacks(config) {
    const raw = config?.channels?.["yach-im-full"]?.toolPacks;
    if (raw === undefined)
        return new Set(["messaging"]);
    if (!Array.isArray(raw))
        return new Set(["messaging"]);
    if (raw.includes("all"))
        return new Set(Object.values(aggregateToolPacks));
    return new Set(raw.filter((value) => typeof value === "string"));
}

export function getEnabledAggregatedTools(config) {
    const packs = resolveEnabledYachPacks(config);
    return aggregatedTools.filter((tool) => packs.has(tool.yachPack));
}

export const legacyToAggregate = legacyToolMapping;
