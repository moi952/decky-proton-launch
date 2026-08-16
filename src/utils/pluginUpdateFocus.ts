// Shared "land on the plugin-update section, expanded and focused" signal —
// used by both the home banner's click and SettingsView's remount-restore
// logic (see index.tsx's view-restoration comment), so they land the same way.
const RESTORE_WINDOW_MS = 5000;
let expandedAt = 0;

export function markPluginUpdateExpanded(): void {
  expandedAt = Date.now();
}

export function isPluginUpdateExpansionFresh(): boolean {
  return Date.now() - expandedAt < RESTORE_WINDOW_MS;
}
