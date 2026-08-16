// Pre-0.10 data lived in localStorage. Read as a fallback, then pruned
// entry-by-entry once confirmed present in the backend — otherwise a
// deleted item keeps coming back from here on every remount.

export function readLegacyArray<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as T[];
  } catch {
    return null;
  }
}

export function readLegacyString(key: string): string | null {
  try {
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

// Explicit, user-confirmed reset — unlike pruneLegacyArray this wipes the
// key unconditionally, so a "clean" action doesn't get undone by recovery
// merging the same legacy entries back in on the next remount.
export function clearLegacyKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // best-effort
  }
}

export function pruneLegacyArray(key: string, confirmedNames: string[]): void {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const confirmed = new Set(confirmedNames);
    const remaining = parsed.filter((item) => !confirmed.has(item?.name));
    if (remaining.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(remaining));
    }
  } catch {
    // best-effort cleanup, legacy data is harmless if left behind
  }
}
