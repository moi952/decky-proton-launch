// This plugin's own id in https://github.com/moi952/decky-plugins'
// manifest — excluded from its own "other plugins" list (a plugin doesn't
// announce itself). Passed to @moi952/decky-plugin-toolkit's
// OtherPluginsProvider (see AppProvider.tsx) — everything else (the
// manifest URL, fetching, seen-state) lives in that shared package.
export const SELF_PLUGIN_ID = "decky-proton-launch";
