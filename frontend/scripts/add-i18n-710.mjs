#!/usr/bin/env node
/**
 * One-shot: inject `theme.label` and `theme.system` into common.json for every
 * locale. Added for GH #710 (light theme + user-facing theme switcher).
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "../src/i18n/locales");

const locales = ["ar", "de", "es", "fr-CA", "he", "hi", "ja", "ko", "nl", "pt", "ru", "zh"];

// Hand-reviewed translations for the two new keys. "Theme" and "System" are
// common UI terms with stable equivalents across every locale we ship.
const translations = {
  ar: { "theme.label": "السمة", "theme.system": "النظام" },
  de: { "theme.label": "Design", "theme.system": "System" },
  es: { "theme.label": "Tema", "theme.system": "Sistema" },
  "fr-CA": { "theme.label": "Thème", "theme.system": "Système" },
  he: { "theme.label": "ערכת נושא", "theme.system": "מערכת" },
  hi: { "theme.label": "थीम", "theme.system": "सिस्टम" },
  ja: { "theme.label": "テーマ", "theme.system": "システム" },
  ko: { "theme.label": "테마", "theme.system": "시스템" },
  nl: { "theme.label": "Thema", "theme.system": "Systeem" },
  pt: { "theme.label": "Tema", "theme.system": "Sistema" },
  ru: { "theme.label": "Тема", "theme.system": "Система" },
  zh: { "theme.label": "主题", "theme.system": "系统" },
};

for (const locale of locales) {
  const path = join(LOCALES_DIR, locale, "common.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  const t = translations[locale];
  // Mirror the English ordering: theme.label goes before theme.light, and
  // theme.system goes right after theme.dark.
  const newData = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "theme.light") {
      newData["theme.label"] = t["theme.label"];
    }
    newData[k] = v;
    if (k === "theme.dark") {
      newData["theme.system"] = t["theme.system"];
    }
  }
  writeFileSync(path, JSON.stringify(newData, null, 2) + "\n", "utf8");
  console.log("Updated", locale);
}

console.log("Done.");
