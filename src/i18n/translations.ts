import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { pluginToolkitTranslations } from "@moi952/decky-plugin-toolkit";

import enUS from "./locales/en-US.json";
import frFR from "./locales/fr-FR.json";
import ptBR from "./locales/pt-BR.json";
import ruRU from "./locales/ru-RU.json";
import jaJP from "./locales/ja-JP.json";
import deDE from "./locales/de-DE.json";
import esES from "./locales/es-ES.json";
import itIT from "./locales/it-IT.json";
import zhCN from "./locales/zh-CN.json";
import koKR from "./locales/ko-KR.json";
import nlNL from "./locales/nl-NL.json";
import plPL from "./locales/pl-PL.json";
import trTR from "./locales/tr-TR.json";
import ukUA from "./locales/uk-UA.json";

const ownByLocale: Record<string, any> = {
  "en-US": enUS,
  "fr-FR": frFR,
  "pt-BR": ptBR,
  "ru-RU": ruRU,
  "ja-JP": jaJP,
  "de-DE": deDE,
  "es-ES": esES,
  "it-IT": itIT,
  "zh-CN": zhCN,
  "ko-KR": koKR,
  "nl-NL": nlNL,
  "pl-PL": plPL,
  "tr-TR": trTR,
  "uk-UA": ukUA,
};

// The toolkit's own fixed namespaces (plugin_update/other_plugins/
// settings_common, and whats_new's own older/newer/dismiss/support_note)
// merged in first — this plugin's own locale files only ever add to them
// (its own "whats_new" changelog entries), never duplicate them.
// whats_new needs its own nested merge: a shallow spread would let this
// plugin's own `whats_new` key (its own version entries) silently replace
// the toolkit's older/newer/support_note instead of adding to them.
const mergeLocale = (toolkit: any, own: any) => ({
  ...toolkit,
  ...own,
  whats_new: { ...toolkit.whats_new, ...own.whats_new },
});

const resources: Record<string, any> = Object.fromEntries(
  Object.entries(pluginToolkitTranslations).map(([locale, toolkit]) => [
    locale,
    mergeLocale(toolkit, ownByLocale[locale] ?? {}),
  ]),
);

// Native language names for display in dropdown
export const LANGUAGE_NAMES: Record<string, string> = {
  "en-US": "English",
  "de-DE": "Deutsch",
  "es-ES": "Español",
  "fr-FR": "Français",
  "it-IT": "Italiano",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "nl-NL": "Nederlands",
  "pl-PL": "Polski",
  "pt-BR": "Português",
  "ru-RU": "Русский",
  "tr-TR": "Türkçe",
  "zh-CN": "简体中文",
  "uk-UA": "Українська",
};

export const loadTranslations = (savedLanguage?: string) => {
  // Use saved language if provided, otherwise use browser language
  const initialLanguage =
    savedLanguage && savedLanguage !== "auto"
      ? savedLanguage
      : navigator.language;

  console.log("[Unifideck] i18n browser language:", navigator.language);
  console.log("[Unifideck] i18n using language:", initialLanguage);

  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: {
      pt: ["pt-BR"],
      fr: ["fr-FR"],
      en: ["en-US"],
      ru: ["ru-RU"],
      ja: ["ja-JP"],
      de: ["de-DE"],
      es: ["es-ES"],
      it: ["it-IT"],
      zh: ["zh-CN"],
      ko: ["ko-KR"],
      nl: ["nl-NL"],
      pl: ["pl-PL"],
      tr: ["tr-TR"],
      uk: ["uk-UA"],
      default: ["en-US"],
    },
    load: "languageOnly",
    defaultNS: "common",
    // The merged bundle's own namespaces, not enUS's — enUS no longer has
    // plugin_update/other_plugins/settings_common (those come from the
    // toolkit merge above), and this list is what i18next actually loads.
    ns: Object.keys(resources["en-US"]),
    interpolation: { escapeValue: false },
    debug: true,
  });

  console.log("[Unifideck] i18n initialized");
};

// Change language at runtime
export const changeLanguage = async (langCode: string): Promise<void> => {
  console.log("[Unifideck] Changing language to:", langCode);
  await i18n.changeLanguage(langCode);
};

// Get list of supported language codes
export const getSupportedLanguages = (): string[] => {
  return Object.keys(resources);
};

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || "en-US";
};
