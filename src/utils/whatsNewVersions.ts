import i18n from "i18next";

const VERSION_KEY_RE = /^v(\d+)_(\d+)_(\d+)$/;

const parseKey = (key: string): number[] | null => {
  const m = key.match(VERSION_KEY_RE);
  return m ? m.slice(1).map(Number) : null;
};

// Newest-first list of "vX_Y_Z" whats_new keys, read from whichever locale
// bundle has them (all locales get every entry at the same time, see
// [[feedback_whats_new_convention]]).
export const getWhatsNewVersionKeys = (): string[] => {
  const bundle =
    i18n.getResourceBundle(i18n.language, "whats_new") ||
    i18n.getResourceBundle("en-US", "whats_new") ||
    {};

  return Object.keys(bundle)
    .filter((k) => VERSION_KEY_RE.test(k))
    .sort((a, b) => {
      const pa = parseKey(a)!;
      const pb = parseKey(b)!;
      for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pb[i] - pa[i];
      }
      return 0;
    });
};
