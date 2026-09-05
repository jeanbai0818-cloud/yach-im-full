// The complete tool index is imported once so the 284-tool registry cannot
// drift when a new migrated domain is added. Each descriptor remains lazy:
// its business API is loaded by execute(), not during plugin discovery.
import * as allTools from "./yach-im-full/plugin/tools/index.js";

const exportedTools = (module) => Object.values(module).filter((value) =>
    value && typeof value === "object" && typeof value.name === "string" && typeof value.execute === "function");

export const fullTools = exportedTools(allTools);

const toolNames = fullTools.map((tool) => tool.name);
if (new Set(toolNames).size !== toolNames.length) {
    throw new Error("yach-im-full migrated tool names must be unique");
}

export const fullToolNames = toolNames;

// Side-effecting tools stay available, but require explicit tool opt-in and a
// per-call plugin approval. The prefix list is intentionally broad: a newly
// migrated write capability must fail closed instead of becoming an
// unapproved external mutation because it was omitted from a hand-maintained
// list.
const SIDE_EFFECTING_PREFIXES = [
    "yach_add_", "yach_accept_", "yach_ask_", "yach_aiseek_", "yach_batch_",
    "yach_book_", "yach_cancel_", "yach_change_", "yach_comment_", "yach_confirm_",
    "yach_continue_", "yach_convert_", "yach_create_", "yach_del_", "yach_delete_", "yach_dismiss_",
    "yach_edit_", "yach_feedback_", "yach_follow_", "yach_handle_", "yach_ignore_",
    "yach_install_", "yach_join_", "yach_lore_node_add", "yach_lore_node_collaborators_add",
    "yach_lore_node_collaborators_del", "yach_lore_node_collaborators_edit", "yach_lore_node_delete",
    "yach_lore_node_drag", "yach_lore_node_rename", "yach_lore_node_share_set_",
    "yach_lore_space_auth_add", "yach_lore_space_auth_del", "yach_lore_space_auth_edit",
    "yach_lore_upload_", "yach_lore_write_", "yach_mark_", "yach_mute_", "yach_oapi_message_single_send",
    "yach_punch_", "yach_quit_", "yach_recall_", "yach_reject_", "yach_regenerate_",
    "yach_remove_", "yach_rename_", "yach_respond_", "yach_save_", "yach_send_",
    "yach_set_", "yach_share_", "yach_stop_", "yach_submit_", "yach_sync_", "yach_top_",
    "yach_unfollow_", "yach_update_", "yach_upload_", "yach_use_", "yach_zan_",
];

export const sideEffectingToolNames = new Set(
    fullToolNames.filter((name) => SIDE_EFFECTING_PREFIXES.some((prefix) => name.startsWith(prefix))),
);

// These are writes that do not start with a generic CRUD/send prefix.
for (const name of [
    "yach_ai_image_comeducation",
    "yach_intelloft_vote",
    "yach_change_intelloft_option",
    "yach_sort_session_top",
]) {
    sideEffectingToolNames.add(name);
}
// Batch file-info is a read-only lookup despite sharing the batch prefix.
sideEffectingToolNames.delete("yach_batch_get_file_info");

// Keep the user-facing contract honest for migrated descriptors that came
// from older tool modules and only said "write" or "send" without an explicit
// confirmation requirement. The runtime approval hook below is the guardrail;
// this text makes the same rule visible to the agent before execution.
for (const tool of fullTools) {
    if (!sideEffectingToolNames.has(tool.name))
        continue;
    const description = String(tool.description ?? "");
    if (!/(确认|授权)/u.test(description))
        tool.description = `${description.replace(/[。！!]?$/u, "")}，执行前需用户确认。`;
}

// These tools return message, organization, personal, or platform data. They
// remain in the package and in the manifest, but an operator must explicitly
// allow them before the model can discover them.
export const sensitiveToolNames = new Set([
    "yach_get_history", "yach_search_messages", "yach_get_message_highlights", "yach_get_group_unread",
    "yach_search_users", "yach_get_user_card", "yach_list_depts", "yach_get_org_users",
    "yach_get_users_by_id_list", "yach_get_platform_config", "yach_get_user_config",
    "yach_list_contacts", "yach_get_workstate_info", "yach_get_group_users", "yach_get_group_info",
    "yach_list_squads", "yach_get_group_announcements", "yach_get_group_announcement_detail",
    "yach_get_group_announcement_check", "yach_get_group_apply_list", "yach_get_group_apply_count",
    "yach_get_group_apply_config", "yach_get_external_apply_status", "yach_list_my_external_apps",
    "yach_list_external_contacts", "yach_list_sessions", "yach_get_top_sessions",
    "yach_get_session_top_list", "yach_get_session_top_config", "yach_get_group_emot_list",
    "yach_get_group_emot_one", "yach_get_avatar_info", "yach_get_side_bar_conf", "yach_get_discuss_info",
    "yach_get_discuss_msg_list", "yach_get_vote_detail", "yach_get_vote_count",
]);

// All migrated business tools are opt-in capabilities. This keeps discovery
// safe by default while allowing an operator to enable the complete package
// with tools.alsoAllow: ["yach-im-full"].
export const optionalToolNames = new Set(fullToolNames);

// OpenClaw passes its trusted filesystem/media policy to tool factories. Keep
// the other migrated tools as ordinary descriptors, but bind that context for
// every tool that can turn a local path into an outbound upload.
const HOST_MEDIA_TOOL_NAMES = new Set([
    "yach_send_message",
    "yach_lore_upload_file",
    "yach_send_mail",
    "yach_upload_avatar",
]);

function bindToolContext(tool, context) {
    return {
        ...tool,
        async execute(toolCallId, params, signal, onUpdate) {
            return tool.execute(toolCallId, params, signal, onUpdate, context);
        },
    };
}

function createHostMediaToolFactory(tool) {
    const factory = (context) => bindToolContext(tool, context);
    // Keep the legacy discovery test and host diagnostics able to identify the
    // factory without executing it.
    Object.defineProperty(factory, "name", { value: tool.name, configurable: true });
    return factory;
}

export function registerFullTools(api) {
    for (const tool of fullTools) {
        if (optionalToolNames.has(tool.name)) {
            api.registerTool(
                HOST_MEDIA_TOOL_NAMES.has(tool.name) ? createHostMediaToolFactory(tool) : tool,
                { optional: true },
            );
        }
        else {
            api.registerTool(tool);
        }
    }
}
