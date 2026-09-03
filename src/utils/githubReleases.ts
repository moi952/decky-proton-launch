import { call } from "@decky/api";
// @ts-ignore — replaced at build time by rollup with the content of plugin.json
import manifest from "@decky/manifest";

// The interactive Settings UI's check now goes through the same backend
// resolver plugin_updater.py's own mount-time notification uses
// (check_plugin_update_now) — see fetchLatestReleaseInfo below — instead
// of its own separate frontend fetch(), so both paths get the same
// api.github.com-free resolution (see plugin_updater.py's own docstring
// for why: the anonymous 60/hour/IP quota was getting exhausted fast with
// every plugin doing its own check on every load).
const REPO = "moi952/decky-proton-launch";
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases?per_page=15`;
const FALLBACK_RELEASE_URL = `https://github.com/${REPO}/releases/latest`;

export const CURRENT_VERSION: string = manifest?.version ?? "0.0.0";
export const PLUGIN_DISPLAY_NAME: string =
  manifest?.name ?? "Decky Proton Launch";

export interface PluginRelease {
  tag: string;
  version: string;
  url: string;
  asset_url: string;
  sha256: string;
  prerelease: boolean;
}

export interface PluginUpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_url: string;
  asset_url: string;
  sha256: string;
  plugin_display_name: string;
  checked_ok: boolean;
}

const versionParts = (v: string): number[] =>
  v
    .replace(/^v/i, "")
    .split(".")
    .map((p) => parseInt(p, 10) || 0);

// Positive if a > b, negative if a < b, 0 if equal.
export const compareVersions = (a: string, b: string): number => {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
};

export const releaseFromJson = (data: any): PluginRelease | null => {
  const tag = data?.tag_name;
  if (!tag) return null;
  const assets: any[] = data.assets ?? [];
  // release.yml uploads exactly one asset per release (the zipped plugin
  // build) — pick whichever asset actually looks like it.
  const zipAsset = assets.find((a) => String(a?.name ?? "").endsWith(".zip"));
  // GitHub's release-asset "digest" field (sha256:<hex>) isn't guaranteed
  // present — Decky's own installer treats an empty checksum as "skip
  // verification", so this degrades gracefully either way.
  const digest: string = zipAsset?.digest ?? "";
  const sha256 = digest.startsWith("sha256:") ? digest.slice(7) : "";
  return {
    tag,
    version: String(tag).replace(/^v/i, ""),
    url: data.html_url ?? FALLBACK_RELEASE_URL,
    asset_url: zipAsset?.browser_download_url ?? "",
    sha256,
    prerelease: !!data.prerelease,
  };
};

const emptyInfo = (checkedOk: boolean): PluginUpdateInfo => ({
  current_version: CURRENT_VERSION,
  latest_version: "",
  has_update: false,
  release_url: FALLBACK_RELEASE_URL,
  asset_url: "",
  sha256: "",
  plugin_display_name: PLUGIN_DISPLAY_NAME,
  checked_ok: checkedOk,
});

export const fetchLatestReleaseInfo = async (): Promise<PluginUpdateInfo> => {
  try {
    const info = await call<[], PluginUpdateInfo>("check_plugin_update_now");
    return info ?? emptyInfo(false);
  } catch {
    return emptyInfo(false);
  }
};

export const fetchPluginReleases = async (): Promise<PluginRelease[]> => {
  try {
    const res = await fetch(RELEASES_URL);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map(releaseFromJson)
      .filter((r): r is PluginRelease => !!r && !!r.asset_url);
  } catch {
    return [];
  }
};
