/**
 * Module-level cover cache — persists for the lifetime of the plugin session.
 * Key: appid, Value: base64 data URL or "" (not found)
 */
const cache = new Map<number, string>();

export function getCachedCover(appid: number): string | undefined {
  return cache.get(appid);
}

export function setCachedCover(appid: number, url: string): void {
  cache.set(appid, url);
}
