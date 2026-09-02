// The plugin manifest this component's own OtherPluginsContext is built
// on — see https://github.com/moi952/decky-plugins for the schema and how
// to add a new entry. jsdelivr, not raw.githubusercontent.com — a real
// CDN with caching, no request-rate limits.
export const OTHER_PLUGINS_MANIFEST_URL =
  "https://cdn.jsdelivr.net/gh/moi952/decky-plugins@main/plugins.json";

// This plugin's own id in that manifest — excluded from its own "other
// plugins" notification/list (a plugin doesn't announce itself).
export const SELF_PLUGIN_ID = "decky-proton-launch";

export interface OtherPluginEntry {
  id: string;
  name: string;
  url: string;
  icon: string;
  steamOsOnly?: boolean;
  description: Record<string, string>;
}

export interface OtherPluginsManifest {
  schemaVersion: number;
  plugins: OtherPluginEntry[];
}

// description is keyed by locale, with en-US as the guaranteed fallback —
// see decky-plugins' own README for the full locale list it maintains.
export const localizedDescription = (entry: OtherPluginEntry, locale: string): string =>
  entry.description[locale] ?? entry.description["en-US"] ?? "";
