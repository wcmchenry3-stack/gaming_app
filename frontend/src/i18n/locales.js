/**
 * Supported locales configuration — single source of truth.
 * Add a new locale here only; every other consumer derives from this array.
 */
export const LOCALES = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸", dir: "ltr" },
  { code: "fr-CA", label: "French (Canadian)", nativeLabel: "Français", flag: "🇨🇦", dir: "ltr" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳", dir: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦", dir: "rtl" },
  { code: "zh", label: "Chinese (Mandarin)", nativeLabel: "中文", flag: "🇨🇳", dir: "ltr" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵", dir: "ltr" },
  { code: "ko", label: "Korean", nativeLabel: "한국어", flag: "🇰🇷", dir: "ltr" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", flag: "🇧🇷", dir: "ltr" },
  { code: "he", label: "Hebrew", nativeLabel: "עברית", flag: "🇮🇱", dir: "rtl" },
  { code: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "nl", label: "Dutch", nativeLabel: "Nederlands", flag: "🇳🇱", dir: "ltr" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", flag: "🇷🇺", dir: "ltr" },
];

export const RTL_LOCALES = new Set(LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code));
