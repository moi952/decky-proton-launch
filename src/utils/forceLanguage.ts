import { LANGUAGE_NAMES } from "../i18n/translations";

// Pseudo-variable: its value is the locale, the wrapper turns it into
// LANG + LC_ALL for non-Steam games only.
export const FORCE_LANG_ENV = "DPL_FORCE_LANG";

// Region used when the UI language carries none ("fr" rather than "fr-FR").
const DEFAULT_REGION: Record<string, string> = {
  de: "DE",
  en: "US",
  es: "ES",
  fr: "FR",
  it: "IT",
  ja: "JP",
  ko: "KR",
  nl: "NL",
  pl: "PL",
  pt: "BR",
  ru: "RU",
  tr: "TR",
  uk: "UA",
  zh: "CN",
};

export interface DetectedLocale {
  // What the Steam UI reports, untouched — shown so a wrong guess is visible.
  source: string;
  // e.g. "fr_FR.UTF-8"
  locale: string;
  // Native language name, falls back to the locale itself.
  label: string;
}

export const detectLocale = (): DetectedLocale => {
  const source = navigator.language || "en-US";
  const [lang, region] = source.split(/[-_]/);
  const code = (lang || "en").toLowerCase();
  const country = (
    region && /^[A-Za-z]{2}$/.test(region)
      ? region
      : (DEFAULT_REGION[code] ?? code)
  ).toUpperCase();
  const label =
    Object.entries(LANGUAGE_NAMES).find(([key]) =>
      key.toLowerCase().startsWith(`${code}-`),
    )?.[1] ?? `${code}_${country}`;
  return { source, locale: `${code}_${country}.UTF-8`, label };
};

// The command only exists for non-Steam games; a global one must not count as
// "applied" to a Steam game.
export const reachesGame = (envKey: string, isShortcut: boolean): boolean =>
  envKey !== FORCE_LANG_ENV || isShortcut;
