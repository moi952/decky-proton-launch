import { useEffect, useState } from "react";

/**
 * Module-level cover cache — persists for the lifetime of the plugin session.
 * Key: `${appid}:${type}` — GameRow's cover follows the user's Settings
 * choice (portrait/landscape/banner) while GameCover's own detail-page
 * header always asks for "landscape" specifically, regardless of that
 * setting (see GameCover.tsx); keying on appid alone would let one
 * silently reuse the other's cached art for the same game.
 * Value: base64 data URL or "" (not found)
 */
const cache = new Map<string, string>();
const listeners = new Set<() => void>();

const key = (appid: number, type: string) => `${appid}:${type}`;

export function getCachedCover(appid: number, type: string): string | undefined {
  return cache.get(key(appid, type));
}

export function setCachedCover(appid: number, type: string, url: string): void {
  cache.set(key(appid, type), url);
}

// Clears the in-memory cache and notifies every mounted GameCover/GameRow so
// they refetch — needed after changing the preferred cover image type in
// Settings, since a component that already fetched won't otherwise know its
// cached art is stale.
export function clearCoverCache(): void {
  console.log(`[decky-proton-launch] clearCoverCache: clearing ${cache.size} entrie(s), notifying ${listeners.size} listener(s)`);
  cache.clear();
  listeners.forEach((l) => l());
}

// Bumps whenever clearCoverCache() runs — include it in a fetch effect's
// dependency array to force a refetch without needing the component itself
// to unmount.
export function useCoverCacheVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return version;
}
