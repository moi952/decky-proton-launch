// Same "land on X, scrolled and focused" pattern as pluginUpdateFocus.ts /
// otherPluginsFocus.ts — used by the What's New banner's "Suggest a
// feature" button (see WhatsNewCard.tsx) to land precisely on the real
// feature-request QR code in Settings' GitHub section, instead of a second
// copy of that QR code embedded in the banner itself.
const RESTORE_WINDOW_MS = 5000;
let focusedAt = 0;

export function markFeatureRequestFocus(): void {
  focusedAt = Date.now();
}

export function isFeatureRequestFocusFresh(): boolean {
  return Date.now() - focusedAt < RESTORE_WINDOW_MS;
}
