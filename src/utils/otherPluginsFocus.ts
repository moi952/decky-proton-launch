// Shared "land on the other-plugins section, expanded and focused" signal —
// used by both the home banner's click and SettingsView's remount-restore
// logic, same pattern as pluginUpdateFocus.ts (see index.tsx's own
// view-restoration comment for why this needs to survive a remount).
const RESTORE_WINDOW_MS = 5000;
let expandedAt = 0;

export function markOtherPluginsExpanded(): void {
  expandedAt = Date.now();
}

export function isOtherPluginsExpansionFresh(): boolean {
  return Date.now() - expandedAt < RESTORE_WINDOW_MS;
}
