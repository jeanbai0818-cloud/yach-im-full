import { aggregateToolNames, aggregatedTools, getEnabledAggregatedTools, legacyToolMapping } from "./aggregated-tools.js";

// Public registry: only the bounded aggregate tools are exposed to OpenClaw.
// The 284 legacy descriptors remain internal execution targets in the mapping
// module and are intentionally absent from this registry.
export const fullTools = aggregatedTools;
export const fullToolNames = aggregateToolNames;
export const optionalToolNames = new Set(fullToolNames);

const legacySideEffectingPrefixes = [
    "yach_add_", "yach_accept_", "yach_ask_", "yach_aiseek_", "yach_batch_",
    "yach_book_", "yach_cancel_", "yach_change_", "yach_comment_", "yach_confirm_",
    "yach_continue_", "yach_convert_", "yach_create_", "yach_del_", "yach_delete_",
    "yach_dismiss_", "yach_edit_", "yach_feedback_", "yach_follow_", "yach_handle_",
    "yach_ignore_", "yach_install_", "yach_join_", "yach_lore_node_add",
    "yach_lore_node_collaborators_add", "yach_lore_node_collaborators_del",
    "yach_lore_node_collaborators_edit", "yach_lore_node_delete", "yach_lore_node_drag",
    "yach_lore_node_rename", "yach_lore_node_share_set_", "yach_lore_space_auth_add",
    "yach_lore_space_auth_del", "yach_lore_space_auth_edit", "yach_lore_upload_",
    "yach_lore_write_", "yach_mark_", "yach_mute_", "yach_oapi_message_single_send",
    "yach_punch_", "yach_quit_", "yach_recall_", "yach_reject_", "yach_regenerate_",
    "yach_remove_", "yach_rename_", "yach_respond_", "yach_save_", "yach_send_",
    "yach_set_", "yach_share_", "yach_stop_", "yach_submit_", "yach_sync_",
    "yach_top_", "yach_unfollow_", "yach_update_", "yach_upload_", "yach_use_",
    "yach_zan_",
];

const legacySideEffectingNames = new Set(
    Object.keys(legacyToolMapping).filter((name) => legacySideEffectingPrefixes.some((prefix) => name.startsWith(prefix))),
);
for (const name of [
    "yach_ai_image_comeducation",
    "yach_intelloft_vote",
    "yach_change_intelloft_option",
    "yach_sort_session_top",
])
    legacySideEffectingNames.add(name);
legacySideEffectingNames.delete("yach_batch_get_file_info");

export const sideEffectingActionKeys = new Set(
    Object.entries(legacyToolMapping)
        .filter(([legacyName]) => legacySideEffectingNames.has(legacyName))
        .map(([, entry]) => `${entry.aggregateName}:${entry.action}`),
);

// Tool-level metadata is conservative for host inspection. Runtime approval
// is action-level, so read actions in a mixed aggregate remain approval-free.
export const sideEffectingToolNames = new Set(
    [...sideEffectingActionKeys].map((key) => key.split(":", 1)[0]),
);

export const sensitiveActionKeys = new Set([
    "yach_message_history:get_history",
    "yach_message_search:search_messages",
    "yach_people:search_users",
    "yach_people:get_user_card",
    "yach_people:list_depts",
    "yach_group_directory:get_group_users",
    "yach_group_directory:get_group_info",
    "yach_conversations:list_sessions",
    "yach_mail:read_mail_message",
]);

export const optionalToolNamesByPack = new Map(
    aggregatedTools.map((tool) => [tool.name, tool.yachPack]),
);

function currentConfig(api) {
    try {
        return api?.runtime?.config?.current?.() ?? api?.config ?? {};
    }
    catch {
        return api?.config ?? {};
    }
}

export function registerFullTools(api) {
    const enabledTools = getEnabledAggregatedTools(currentConfig(api));
    for (const tool of enabledTools) {
        api.registerTool(tool, { optional: true });
    }
}

export function isSideEffectingAction(toolName, action) {
    return sideEffectingActionKeys.has(`${toolName}:${action}`);
}

export function isSensitiveAction(toolName, action) {
    return sensitiveActionKeys.has(`${toolName}:${action}`);
}
