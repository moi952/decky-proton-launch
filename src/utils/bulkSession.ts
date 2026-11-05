// What the user had ticked on the bulk page, kept in memory while they peek at
// a game's own page from it — so coming back restores the page as it was.
const MAX_AGE_MS = 10 * 60 * 1000;

interface BulkSession {
  key: string;
  selected: number[];
  search: string;
  at: number;
}

let saved: BulkSession | null = null;

// Identifies what's being applied: the same group / the same variables.
export const bulkSessionKey = (payload: {
  groupId?: string;
  vars: Record<string, string>;
}): string => JSON.stringify([payload.groupId ?? null, payload.vars]);

export const saveBulkSession = (
  key: string,
  selected: Set<number>,
  search: string,
): void => {
  saved = { key, selected: [...selected], search, at: Date.now() };
};

// Handed back once, and only to the same payload while it's still recent — a
// stale selection must never reappear on an unrelated visit later.
export const takeBulkSession = (key: string): BulkSession | null => {
  const session = saved;
  saved = null;
  if (!session || session.key !== key) return null;
  if (Date.now() - session.at > MAX_AGE_MS) return null;
  return session;
};
