import { defineBundledChannelSetupEntry } from "openclaw/plugin-sdk/channel-entry-contract";
// Keep setup discovery independent from the channel transport, NIM client,
// HTTP API client, and long-connection modules. OpenClaw can therefore render
// onboarding/help surfaces without activating either connection.
export default defineBundledChannelSetupEntry({
    importMetaUrl: import.meta.url,
    plugin: {
        specifier: "./setup-plugin-api.js",
        exportName: "yachSetupPlugin",
    },
});
