import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RTL_LOCALES } from "./locales";

/**
 * Keeps <html lang> and <html dir> in sync with the active i18next locale.
 * Call once in a component mounted inside I18nextProvider (e.g. App).
 *
 * No-op on native — guards with typeof document check so Metro doesn't error.
 */
export function useHtmlAttributes() {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const locale = i18n.language;
    document.documentElement.setAttribute("lang", locale);
    document.documentElement.setAttribute("dir", RTL_LOCALES.has(locale) ? "rtl" : "ltr");
  }, [i18n.language]);
}
