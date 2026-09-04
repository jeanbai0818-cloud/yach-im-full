// yach-im-full's migrated communication, group, discussion, and organization
// domains. These descriptors are schema-only at registration time; their
// CommonJS API implementations are loaded by execute().
import * as ch1 from "./yach-im-full/plugin/tools/ch1-messaging.js";
import * as ch2 from "./yach-im-full/plugin/tools/ch2-groups.js";
import * as ch9 from "./yach-im-full/plugin/tools/ch9-org.js";
import * as ch10 from "./yach-im-full/plugin/tools/ch10-announcement.js";
import * as ch11 from "./yach-im-full/plugin/tools/ch11-group-apply.js";
import * as ch12 from "./yach-im-full/plugin/tools/ch12-external-contact.js";
import * as ch13 from "./yach-im-full/plugin/tools/ch13-session-top.js";
import * as ch14 from "./yach-im-full/plugin/tools/ch14-group-emot.js";
import * as ch15 from "./yach-im-full/plugin/tools/ch15-avatar.js";
import * as ch16 from "./yach-im-full/plugin/tools/ch16-sidebar.js";
import * as ch17 from "./yach-im-full/plugin/tools/ch17-discuss.js";
import * as ch21 from "./yach-im-full/plugin/tools/ch21-vote.js";

const exportedTools = (module) => Object.values(module).filter((value) =>
    value && typeof value === "object" && typeof value.name === "string" && typeof value.execute === "function");

export const fullTools = [
    ...exportedTools(ch1),
    ...exportedTools(ch2),
    ...exportedTools(ch9),
    ...exportedTools(ch10),
    ...exportedTools(ch11),
    ...exportedTools(ch12),
    ...exportedTools(ch13),
    ...exportedTools(ch14),
    ...exportedTools(ch15),
    ...exportedTools(ch16),
    ...exportedTools(ch17),
    ...exportedTools(ch21),
];

const toolNames = fullTools.map((tool) => tool.name);
if (new Set(toolNames).size !== toolNames.length) {
    throw new Error("yach-im-full migrated tool names must be unique");
}

export const fullToolNames = toolNames;

// Side-effecting tools stay available, but require explicit tool opt-in and a
// per-call plugin approval. This is the OpenClaw distinction between exposing a
// capability and authorizing one external-state change.
export const sideEffectingToolNames = new Set([
    "yach_send_message", "yach_send_group_text", "yach_send_card", "yach_send_vote",
    "yach_send_at_message", "yach_recall_message", "yach_send_robot_message",
    "yach_add_group_users", "yach_change_group_owner", "yach_create_group", "yach_dismiss_group",
    "yach_edit_group_info", "yach_mute_group", "yach_quit_group", "yach_remove_group_users",
    "yach_set_group_admin", "yach_set_user_info", "yach_set_workstate",
    "yach_create_group_announcement", "yach_delete_group_announcement", "yach_set_group_announcement_top",
    "yach_update_group_announcement", "yach_accept_group_apply", "yach_batch_group_apply",
    "yach_ignore_group_apply", "yach_reject_group_apply", "yach_add_external_contact",
    "yach_delete_external_contact", "yach_handle_external_apply", "yach_add_session_top",
    "yach_remove_session_top", "yach_set_session_top_config", "yach_sort_session_top",
    "yach_add_group_emot", "yach_upload_avatar", "yach_set_side_bar_conf", "yach_add_side_bar_nav",
    "yach_del_side_bar_nav", "yach_create_discuss_group", "yach_dismiss_discuss_group",
    "yach_join_discuss_group", "yach_set_discuss_group_title", "yach_add_user_to_discussion",
    "yach_add_vote_choice", "yach_intelloft_vote",
]);

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

export const optionalToolNames = new Set([
    ...sideEffectingToolNames,
    ...sensitiveToolNames,
]);

export function registerFullTools(api) {
    for (const tool of fullTools) {
        if (optionalToolNames.has(tool.name)) {
            api.registerTool(tool, { optional: true });
        }
        else {
            api.registerTool(tool);
        }
    }
}
