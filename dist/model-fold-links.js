/**
 * Yach IM fold links are native deep links.  Yach IM renders them as clickable
 * Markdown links and sends the value of `reply` back as a fold message.
 */
const FOLD_BASE = "yach://yach.zhiyinlou.com/session/robot?type=fold&extra=%7B%7D&reply=";
export function buildFoldUrl(command) {
    return `${FOLD_BASE}${encodeURIComponent(command)}`;
}
function foldLink(label, command) {
    return `[${label}](${buildFoldUrl(command)})`;
}
/**
 * Convert the standard OpenClaw `/models` response into clickable Yach IM links.
 * Return null when the text is not a model browser response so normal replies
 * are left byte-for-byte unchanged.
 */
export function transformModelTextToFoldLinks(text) {
    const lines = text.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    if (firstLine === "Providers:") {
        return lines.map((line) => {
            const match = line.match(/^(- )(\S+) \((\d+)\)$/u);
            return match
                ? `${match[1]}${foldLink(`${match[2]} (${match[3]})`, `/models ${match[2]}`)}`
                : line;
        }).join("\n");
    }
    if (firstLine.startsWith("Models (")) {
        return lines.map((line) => {
            const model = line.match(/^(- )((\S+)\/(\S+))$/u);
            if (model)
                return `${model[1]}${foldLink(model[2], `/model ${model[2]}`)}`;
            const more = line.match(/^(More: )(\/models .+)$/u);
            if (more)
                return foldLink(line, more[2]);
            const all = line.match(/^(All: )(\/models .+)$/u);
            if (all)
                return foldLink(line, all[2]);
            return line;
        }).join("\n");
    }
    return null;
}
export function decodeFoldContent(content) {
    const match = content.match(/[?&]reply=(.*)$/u);
    if (match?.[1] === undefined)
        return content;
    try {
        return decodeURIComponent(match[1]);
    }
    catch {
        return match[1];
    }
}
//# sourceMappingURL=model-fold-links.js.map