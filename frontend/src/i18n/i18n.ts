import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import * as Localization from "expo-localization";
import { LOCALES } from "./locales";

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
  .use(
    resourcesToBackend(
      (lng: string, ns: string) =>
        import(`./locales/${lng}/${ns}.json`) as Promise<{ default: Record<string, string> }>
    )
  )
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
