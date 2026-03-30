import React, { createContext, useContext, useState, useEffect } from "react";
import i18n from "i18next";
import { call } from "@decky/api";

const DATA_URL =
  "https://raw.githubusercontent.com/moi952/decky-proton-launch-data/main/data.json";

type Variable = {
  env: string;
  title: string;
  type: string;
  value?: string;
  simple?: boolean;
  defaultValue?: string;
  values?: { title: string; value: string }[];
};

export type VariableCategory = {
  category: string;
  variables: Variable[];
};

type RemoteData = {
  variables: VariableCategory[];
  locales: Record<string, { variables: Record<string, string>; categories: Record<string, string> }>;
};

interface RemoteDataContextValue {
  variables: VariableCategory[];
  noData: boolean;
  refresh: () => void;
}

const RemoteDataContext = createContext<RemoteDataContextValue>({
  variables: [],
  noData: false,
  refresh: () => {},
});

export const useRemoteData = () => useContext(RemoteDataContext);

const getLangCode = (): string => {
  const supported = [
    "en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP",
    "ko-KR", "nl-NL", "pl-PL", "pt-BR", "pt-PT", "ru-RU",
    "tr-TR", "uk-UA", "zh-CN",
  ];
  const lang = i18n.language || "en-US";
  if (supported.includes(lang)) return lang;
  const prefix = lang.split("-")[0];
  return supported.find((s) => s.startsWith(prefix)) ?? "en-US";
};

const injectTranslations = (lang: string, localeData: RemoteData["locales"][string]) => {
  i18n.addResourceBundle(lang, "categories", localeData.categories, true, false);
  i18n.addResourceBundle(lang, "variables", localeData.variables, true, true);
};

const applyData = (
  data: RemoteData,
  setVariables: (v: VariableCategory[]) => void,
) => {
  const lang = getLangCode();
  setVariables(data.variables ?? []);
  const localeData = data.locales?.[lang];
  if (localeData) injectTranslations(lang, localeData);
};

const loadData = (
  setVariables: (v: VariableCategory[]) => void,
  setNoData: (v: boolean) => void,
) => {
  let hasData = false;

  const cachePromise = call<[], Record<string, any>>("get_variables_cache").then((cached) => {
    if (cached && (cached as RemoteData).variables?.length) {
      hasData = true;
      applyData(cached as RemoteData, setVariables);
    }
  });

  cachePromise.finally(() => {
    fetch(DATA_URL)
      .then((r) => r.json())
      .then((data: RemoteData) => {
        if (!data?.variables?.length) {
          if (!hasData) setNoData(true);
          return;
        }
        hasData = true;
        setNoData(false);
        applyData(data, setVariables);
        call<[Record<string, any>], boolean>("set_variables_cache", data);
      })
      .catch(() => {
        if (!hasData) setNoData(true);
      });
  });
};

export const RemoteDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [variables, setVariables] = useState<VariableCategory[]>([]);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    loadData(setVariables, setNoData);
  }, []);

  const refresh = () => {
    call<[], boolean>("clear_variables_cache").catch(() => {});
    setVariables([]);
    setNoData(false);
    loadData(setVariables, setNoData);
  };

  return (
    <RemoteDataContext.Provider value={{ variables, noData, refresh }}>
      {children}
    </RemoteDataContext.Provider>
  );
};
