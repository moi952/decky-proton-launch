// Pre-0.10 data lived in localStorage; read-only fallback, never cleared.

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
