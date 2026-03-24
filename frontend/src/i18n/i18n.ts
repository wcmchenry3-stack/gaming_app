import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import * as Localization from "expo-localization";
import { LOCALES } from "./locales";

type Namespace = "common" | "yahtzee" | "fruit-merge" | "errors";
type TranslationModule = Promise<{ default: Record<string, string> }>;

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

const localeLoaders: Record<string, Record<Namespace, () => TranslationModule>> = {
  en: {
    common: () => import("./locales/en/common.json") as TranslationModule,
    yahtzee: () => import("./locales/en/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/en/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/en/errors.json") as TranslationModule,
  },
  "fr-CA": {
    common: () => import("./locales/fr-CA/common.json") as TranslationModule,
    yahtzee: () => import("./locales/fr-CA/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/fr-CA/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/fr-CA/errors.json") as TranslationModule,
  },
  es: {
    common: () => import("./locales/es/common.json") as TranslationModule,
    yahtzee: () => import("./locales/es/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/es/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/es/errors.json") as TranslationModule,
  },
  hi: {
    common: () => import("./locales/hi/common.json") as TranslationModule,
    yahtzee: () => import("./locales/hi/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/hi/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/hi/errors.json") as TranslationModule,
  },
  ar: {
    common: () => import("./locales/ar/common.json") as TranslationModule,
    yahtzee: () => import("./locales/ar/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/ar/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/ar/errors.json") as TranslationModule,
  },
  zh: {
    common: () => import("./locales/zh/common.json") as TranslationModule,
    yahtzee: () => import("./locales/zh/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/zh/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/zh/errors.json") as TranslationModule,
  },
  ja: {
    common: () => import("./locales/ja/common.json") as TranslationModule,
    yahtzee: () => import("./locales/ja/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/ja/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/ja/errors.json") as TranslationModule,
  },
  ko: {
    common: () => import("./locales/ko/common.json") as TranslationModule,
    yahtzee: () => import("./locales/ko/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/ko/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/ko/errors.json") as TranslationModule,
  },
  pt: {
    common: () => import("./locales/pt/common.json") as TranslationModule,
    yahtzee: () => import("./locales/pt/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/pt/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/pt/errors.json") as TranslationModule,
  },
  he: {
    common: () => import("./locales/he/common.json") as TranslationModule,
    yahtzee: () => import("./locales/he/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/he/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/he/errors.json") as TranslationModule,
  },
  de: {
    common: () => import("./locales/de/common.json") as TranslationModule,
    yahtzee: () => import("./locales/de/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/de/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/de/errors.json") as TranslationModule,
  },
  nl: {
    common: () => import("./locales/nl/common.json") as TranslationModule,
    yahtzee: () => import("./locales/nl/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/nl/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/nl/errors.json") as TranslationModule,
  },
  ru: {
    common: () => import("./locales/ru/common.json") as TranslationModule,
    yahtzee: () => import("./locales/ru/yahtzee.json") as TranslationModule,
    "fruit-merge": () => import("./locales/ru/fruit-merge.json") as TranslationModule,
    errors: () => import("./locales/ru/errors.json") as TranslationModule,
  },
};

function loadLocaleNamespace(lng: string, ns: string): TranslationModule {
  const namespace = ns as Namespace;
  const localeNamespaces = localeLoaders[lng] ?? localeLoaders.en;
  const loader = localeNamespaces[namespace] ?? localeLoaders.en[namespace];
  return loader();
}

i18n
  .use(resourcesToBackend(loadLocaleNamespace))
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
