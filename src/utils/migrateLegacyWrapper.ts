import { call } from "@decky/api";

declare const SteamClient: any;

// Pre-#24 path — see profile.legacy_script_path() on the backend.
const LEGACY_WRAPPER_PATH = "~/proton-launch";
const WRAPPER_PATH = "~/.config/decky-proton-launch/proton-launch";

// Regular Steam games keep their launch options live in Steam's own memory
// while it's running — a direct edit of localconfig.vdf gets silently
// clobbered when Steam flushes that state back to disk (confirmed). Going
// through SteamClient here reads and writes Steam's actual live state, so
// it can't be raced like that. Non-Steam shortcuts don't have this problem
// and are migrated directly on disk by the backend.
let migrationAttempted = false;

function getAppLaunchOptions(appId: number): Promise<string> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(""), 2000);
    const { unregister } = SteamClient.Apps.RegisterForAppDetails(
      appId,
      (details: any) => {
        clearTimeout(timeoutId);
        unregister();
        resolve(details?.strLaunchOptions ?? "");
      },
    );
  });
}

export async function migrateLegacyWrapper(): Promise<void> {
  if (migrationAttempted) return;
  migrationAttempted = true;

  try {
    const appIds = await call<[], number[]>("get_legacy_wrapper_apps");
    for (const appId of appIds) {
      const current = await getAppLaunchOptions(appId);
      if (current.includes(LEGACY_WRAPPER_PATH)) {
        const updated = current.replace(LEGACY_WRAPPER_PATH, WRAPPER_PATH);
        SteamClient.Apps.SetAppLaunchOptions(appId, updated);
      }
    }
  } catch {
    // Best-effort — the backend keeps the legacy wrapper around until a
    // future run confirms nothing references it anymore.
  }

  call<[], boolean>("finalize_wrapper_migration").catch(() => {});
}
