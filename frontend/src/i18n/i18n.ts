import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import * as Localization from "expo-localization";
import { LOCALES } from "./locales";

type NamespaceResources = Record<string, string>;

const TRANSLATION_LOADERS: Record<string, Record<string, () => Promise<NamespaceResources>>> = {
  en: {
    common: () => import("./locales/en/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/en/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/en/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/en/errors.json").then((module) => module.default),
  },
  "fr-CA": {
    common: () => import("./locales/fr-CA/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/fr-CA/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/fr-CA/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/fr-CA/errors.json").then((module) => module.default),
  },
  es: {
    common: () => import("./locales/es/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/es/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/es/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/es/errors.json").then((module) => module.default),
  },
  hi: {
    common: () => import("./locales/hi/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/hi/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/hi/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/hi/errors.json").then((module) => module.default),
  },
  ar: {
    common: () => import("./locales/ar/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/ar/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/ar/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/ar/errors.json").then((module) => module.default),
  },
  zh: {
    common: () => import("./locales/zh/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/zh/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/zh/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/zh/errors.json").then((module) => module.default),
  },
  ja: {
    common: () => import("./locales/ja/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/ja/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/ja/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/ja/errors.json").then((module) => module.default),
  },
  ko: {
    common: () => import("./locales/ko/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/ko/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/ko/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/ko/errors.json").then((module) => module.default),
  },
  pt: {
    common: () => import("./locales/pt/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/pt/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/pt/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/pt/errors.json").then((module) => module.default),
  },
  he: {
    common: () => import("./locales/he/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/he/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/he/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/he/errors.json").then((module) => module.default),
  },
  de: {
    common: () => import("./locales/de/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/de/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/de/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/de/errors.json").then((module) => module.default),
  },
  nl: {
    common: () => import("./locales/nl/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/nl/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/nl/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/nl/errors.json").then((module) => module.default),
  },
  ru: {
    common: () => import("./locales/ru/common.json").then((module) => module.default),
    yahtzee: () => import("./locales/ru/yahtzee.json").then((module) => module.default),
    "fruit-merge": () =>
      import("./locales/ru/fruit-merge.json").then((module) => module.default),
    errors: () => import("./locales/ru/errors.json").then((module) => module.default),
  },
};

function loadNamespace(locale: string, namespace: string): Promise<NamespaceResources> {
  const localeLoaders = TRANSLATION_LOADERS[locale];
  const namespaceLoader = localeLoaders?.[namespace];

  if (!namespaceLoader) {
    return Promise.reject(
      new Error(`Missing translation loader for locale "${locale}" and namespace "${namespace}"`)
    );
  }

  return namespaceLoader();
}

// Resolve the best supported locale from the device's preference list
function resolveLocale(): string {
  const deviceLocales = Localization.getLocales();
  const supported = new Set(LOCALES.map((l) => l.code));

  for (const { languageTag, languageCode } of deviceLocales) {
    if (supported.has(languageTag)) return languageTag;
    // Fall back to base language code (e.g. "fr" matches "fr-CA")
    const match = LOCALES.find((l) => l.code.split("-")[0] === languageCode);
    if (match) return match.code;
  }
  return "en";
}

i18n
  .use(resourcesToBackend((lng: string, ns: string) => loadNamespace(lng, ns)))
  .use(initReactI18next)
  .init({
    lng: resolveLocale(),
    fallbackLng: "en",
    supportedLngs: LOCALES.map((l) => l.code),
    ns: ["common", "yahtzee", "fruit-merge", "errors"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: true },
  });

export default i18n;
