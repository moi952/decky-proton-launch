// @ts-ignore — replaced at build time by rollup with the content of plugin.json
import manifest from "@decky/manifest";
import { fetchPluginReleases as fetchReleasesForRepo, PluginRelease } from "@moi952/decky-plugin-toolkit";

// A second copy lives at the repo root (for the Python backend and
// package.sh's zip, which don't include src/) — this one is for the
// frontend's own static import, since @rollup/plugin-typescript chokes on
// importing a JSON file from outside tsconfig's "include" (["src"]).
// Keep both copies in sync (same convention as decky-quick-tab's own
// src/project.config.json).
import projectConfig from "../project.config.json";

export const CURRENT_VERSION: string = manifest?.version ?? "0.0.0";

const REPO = `${projectConfig.githubOwner}/${projectConfig.githubRepo}`;

// Passed as GitHubSection's `fetchReleases` prop — only this plugin's own
// repo is specific to proton-launch, the actual fetch/parse logic lives in
// the toolkit (fetchPluginReleases).
export const fetchPluginReleases = (): Promise<PluginRelease[]> => fetchReleasesForRepo(REPO);
