import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "../src/i18n/locales");

const locales = ["ar", "de", "es", "fr-CA", "he", "hi", "ja", "ko", "nl", "pt", "ru", "zh"];

const translations = {
  ar: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "رصيد",
    "header.bankrollAccessibilityLabel": "الرصيد: {{chips}} رقاقة",
    "hud.currentPot": "رهان",
    "hud.currentPotAccessibilityLabel": "الرهان الحالي: {{amount}} رقاقة",
    "hud.lastWin": "أخيراً",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "تعادل",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "آخر نتيجة: {{result}}",
  },
  de: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "Bankroll",
    "header.bankrollAccessibilityLabel": "Bankroll: {{chips}} Chips",
    "hud.currentPot": "Einsatz",
    "hud.currentPotAccessibilityLabel": "Aktueller Einsatz: {{amount}} Chips",
    "hud.lastWin": "Letzter",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "Unentsch.",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "Letztes Ergebnis: {{result}}",
  },
  es: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "Bankroll",
    "header.bankrollAccessibilityLabel": "Bankroll: {{chips}} fichas",
    "hud.currentPot": "Apuesta",
    "hud.currentPotAccessibilityLabel": "Apuesta actual: {{amount}} fichas",
    "hud.lastWin": "Último",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "Empate",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "Último resultado: {{result}}",
  },
  "fr-CA": {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "Bankroll",
    "header.bankrollAccessibilityLabel": "Bankroll: {{chips}} jetons",
    "hud.currentPot": "Mise",
    "hud.currentPotAccessibilityLabel": "Mise actuelle: {{amount}} jetons",
    "hud.lastWin": "Dernier",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "Égalité",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "Dernier résultat: {{result}}",
  },
  he: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "יתרה",
    "header.bankrollAccessibilityLabel": "יתרה: {{chips}} צ'יפס",
    "hud.currentPot": "הימור",
    "hud.currentPotAccessibilityLabel": "הימור נוכחי: {{amount}} צ'יפס",
    "hud.lastWin": "אחרון",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "שוויון",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "תוצאה אחרונה: {{result}}",
  },
  hi: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "बैंकरोल",
    "header.bankrollAccessibilityLabel": "बैंकरोल: {{chips}} चिप्स",
    "hud.currentPot": "शर्त",
    "hud.currentPotAccessibilityLabel": "वर्तमान शर्त: {{amount}} चिप्स",
    "hud.lastWin": "अंतिम",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "बराबरी",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "अंतिम परिणाम: {{result}}",
  },
  ja: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "残高",
    "header.bankrollAccessibilityLabel": "残高: {{chips}} チップ",
    "hud.currentPot": "賭け",
    "hud.currentPotAccessibilityLabel": "現在の賭け: {{amount}} チップ",
    "hud.lastWin": "前回",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "引き分け",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "前回の結果: {{result}}",
  },
  ko: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "잔액",
    "header.bankrollAccessibilityLabel": "잔액: {{chips}} 칩",
    "hud.currentPot": "배팅",
    "hud.currentPotAccessibilityLabel": "현재 배팅: {{amount}} 칩",
    "hud.lastWin": "이전",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "무승부",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "이전 결과: {{result}}",
  },
  nl: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "Bankroll",
    "header.bankrollAccessibilityLabel": "Bankroll: {{chips}} chips",
    "hud.currentPot": "Inzet",
    "hud.currentPotAccessibilityLabel": "Huidige inzet: {{amount}} chips",
    "hud.lastWin": "Laatste",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "Gelijkspel",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "Laatste resultaat: {{result}}",
  },
  pt: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "Bankroll",
    "header.bankrollAccessibilityLabel": "Bankroll: {{chips}} fichas",
    "hud.currentPot": "Aposta",
    "hud.currentPotAccessibilityLabel": "Aposta atual: {{amount}} fichas",
    "hud.lastWin": "Último",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "Empate",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "Último resultado: {{result}}",
  },
  ru: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "Банкролл",
    "header.bankrollAccessibilityLabel": "Банкролл: {{chips}} фишек",
    "hud.currentPot": "Ставка",
    "hud.currentPotAccessibilityLabel": "Текущая ставка: {{amount}} фишек",
    "hud.lastWin": "Посл.",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "Ничья",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "Посл. результат: {{result}}",
  },
  zh: {
    "header.brandName": "BC Arcade",
    "header.bankrollLabel": "筹码",
    "header.bankrollAccessibilityLabel": "筹码: {{chips}} 个",
    "hud.currentPot": "下注",
    "hud.currentPotAccessibilityLabel": "当前下注: {{amount}} 个",
    "hud.lastWin": "上局",
    "hud.lastWinPositive": "+{{amount}}",
    "hud.lastWinNegative": "{{amount}}",
    "hud.lastWinZero": "平局",
    "hud.lastWinNull": "—",
    "hud.lastWinAccessibilityLabel": "上局结果: {{result}}",
  },
};

for (const locale of locales) {
  const path = join(LOCALES_DIR, locale, "blackjack.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  const t = translations[locale];
  // Insert new keys before "rules.title"
  const newData = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "rules.title") {
      for (const [nk, nv] of Object.entries(t)) {
        newData[nk] = nv;
      }
    }
    newData[k] = v;
  }
  writeFileSync(path, JSON.stringify(newData, null, 2) + "\n", "utf8");
  console.log("Updated", locale);
}

console.log("Done.");
