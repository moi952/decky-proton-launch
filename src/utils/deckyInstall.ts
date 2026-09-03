import { call } from "@decky/api";

import { PluginRelease } from "./githubReleases";

// Decky Loader's own PluginInstallType enum — verified against
// backend/decky_loader/browser.py in SteamDeckHomebrew/decky-loader. Only
// used for labeling Decky's own native install-confirm dialog; the actual
// install always installs whatever artifact/version/hash was passed
// regardless of this value.
export enum PluginInstallType {
  INSTALL = 0,
  REINSTALL = 1,
  UPDATE = 2,
  DOWNGRADE = 3,
}

// window.DeckyBackend lives on whichever window actually created this
// document. In Gaming Mode the Quick Access panel renders inside a popup
// window (opened via window.open by Big Picture Mode) — DeckyBackend is
// undefined on that popup's own `window` there, but reachable via
// `window.opener`.
export const getDeckyBackend = (): Window["DeckyBackend"] | null =>
  window.DeckyBackend ?? window.opener?.DeckyBackend ?? null;

// Same native installer the Decky Store itself uses — not scoped to this
// plugin at all, so it works just as well for triggering an install of a
// completely different one (see OtherPluginsContext). Only registers the
// request and pops Decky's own native confirm modal (which owns the
// actual download/install and its own progress bar) — returns as soon as
// that request is registered, not when the install itself finishes.
export const installPlugin = (
  assetUrl: string,
  displayName: string,
  version: string,
  sha256: string,
  installType: PluginInstallType,
): Promise<void> => {
  const backend = getDeckyBackend();
  if (!backend) return Promise.reject(new Error("no_backend"));
  return backend.call(
    "utilities/install_plugin",
    assetUrl,
    displayName,
    version,
    sha256 || "",
    installType,
  );
};

// Owner/repo parsed straight from a plain https://github.com/<owner>/<repo>
// URL — every entry in decky-plugins' own manifest already has one.
const parseGitHubRepo = (repoUrl: string): { owner: string; repo: string } | null => {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)\/?$/);
  return match ? { owner: match[1], repo: match[2] } : null;
};

// Latest release for an arbitrary public GitHub repo (not just this
// plugin's own) — resolved backend-side via resolve_other_plugin_release,
// the same api.github.com-free lookup this plugin's own self-update uses
// (see plugin_updater.py's resolve_latest_release), valid here too since
// every plugin in moi952/decky-plugins' manifest shares the same
// release.yml asset-naming convention. `parsed.repo` doubles as the
// plugin name that convention needs (repo name == plugin.json "name" for
// all of these).
export const fetchLatestReleaseFor = async (repoUrl: string): Promise<PluginRelease | null> => {
  const parsed = parseGitHubRepo(repoUrl);
  if (!parsed) return null;
  try {
    return await call<[string, string, string], PluginRelease | null>(
      "resolve_other_plugin_release",
      parsed.owner,
      parsed.repo,
      parsed.repo,
    );
  } catch {
    return null;
  }
};
