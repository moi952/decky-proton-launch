// @ts-ignore — replaced at build time by rollup with the content of plugin.json
import manifest from "@decky/manifest";

// Fetched directly from the frontend for the interactive Settings UI —
// simpler and proven reliable here, unlike the backend curl check
// (plugin_updater.py) used separately for the mount-time notification,
// which needs to run before any UI even exists.
const REPO = "moi952/decky-proton-launch";
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
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

const releaseFromJson = (data: any): PluginRelease | null => {
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
    const res = await fetch(LATEST_RELEASE_URL);
    if (!res.ok) return emptyInfo(false);
    const release = releaseFromJson(await res.json());
    if (!release) return emptyInfo(false);
    return {
      current_version: CURRENT_VERSION,
      latest_version: release.version,
      has_update: compareVersions(release.version, CURRENT_VERSION) > 0,
      release_url: release.url,
      asset_url: release.asset_url,
      sha256: release.sha256,
      plugin_display_name: PLUGIN_DISPLAY_NAME,
      checked_ok: true,
    };
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
