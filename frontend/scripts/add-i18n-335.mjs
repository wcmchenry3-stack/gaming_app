import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "../src/i18n/locales");

const locales = ["ar", "de", "es", "fr-CA", "he", "hi", "ja", "ko", "nl", "pt", "ru", "zh"];

const translations = {
  ar: {
    "betting.clearBet": "مسح",
    "betting.clearBetLabel": "مسح الرهان — إعادة تعيين إلى الصفر",
    "betting.tableLimits": "حدود الطاولة",
    "betting.tableLimitsRange": "{{min}}–{{max}} رقاقة",
    "betting.tapToAdd": "اضغط الرقاقات للرهان",
    "chip.addLabel": "أضف {{amount}} للرهان",
    "chip.disabledLabel": "رقاقة {{amount}} غير متاحة",
    "chip.vipCredits": "VIP",
  },
  de: {
    "betting.clearBet": "Löschen",
    "betting.clearBetLabel": "Einsatz löschen — auf null zurücksetzen",
    "betting.tableLimits": "Tischlimits",
    "betting.tableLimitsRange": "{{min}}–{{max}} Chips",
    "betting.tapToAdd": "Chips antippen zum Wetten",
    "chip.addLabel": "{{amount}} zum Einsatz hinzufügen",
    "chip.disabledLabel": "{{amount}}-Chip nicht verfügbar",
    "chip.vipCredits": "VIP",
  },
  es: {
    "betting.clearBet": "Borrar",
    "betting.clearBetLabel": "Borrar apuesta — reiniciar a cero",
    "betting.tableLimits": "Límites de mesa",
    "betting.tableLimitsRange": "{{min}}–{{max}} fichas",
    "betting.tapToAdd": "Toca fichas para apostar",
    "chip.addLabel": "Añadir {{amount}} a la apuesta",
    "chip.disabledLabel": "Ficha de {{amount}} no disponible",
    "chip.vipCredits": "VIP",
  },
  "fr-CA": {
    "betting.clearBet": "Effacer",
    "betting.clearBetLabel": "Effacer la mise — remettre à zéro",
    "betting.tableLimits": "Limites de table",
    "betting.tableLimitsRange": "{{min}}–{{max}} jetons",
    "betting.tapToAdd": "Touchez les jetons pour miser",
    "chip.addLabel": "Ajouter {{amount}} à la mise",
    "chip.disabledLabel": "Jeton de {{amount}} non disponible",
    "chip.vipCredits": "VIP",
  },
  he: {
    "betting.clearBet": "נקה",
    "betting.clearBetLabel": "נקה הימור — אפס לאפס",
    "betting.tableLimits": "מגבלות שולחן",
    "betting.tableLimitsRange": "{{min}}–{{max}} צ'יפס",
    "betting.tapToAdd": "הקש צ'יפס להימור",
    "chip.addLabel": "הוסף {{amount}} להימור",
    "chip.disabledLabel": "צ'יפ {{amount}} אינו זמין",
    "chip.vipCredits": "VIP",
  },
  hi: {
    "betting.clearBet": "मिटाएं",
    "betting.clearBetLabel": "शर्त मिटाएं — शून्य पर रीसेट करें",
    "betting.tableLimits": "टेबल सीमाएं",
    "betting.tableLimitsRange": "{{min}}–{{max}} चिप्स",
    "betting.tapToAdd": "शर्त लगाने के लिए चिप्स टैप करें",
    "chip.addLabel": "शर्त में {{amount}} जोड़ें",
    "chip.disabledLabel": "{{amount}} चिप उपलब्ध नहीं",
    "chip.vipCredits": "VIP",
  },
  ja: {
    "betting.clearBet": "クリア",
    "betting.clearBetLabel": "賭けをクリア — ゼロにリセット",
    "betting.tableLimits": "テーブルリミット",
    "betting.tableLimitsRange": "{{min}}–{{max}} チップ",
    "betting.tapToAdd": "チップをタップして賭ける",
    "chip.addLabel": "{{amount}} を賭けに追加",
    "chip.disabledLabel": "{{amount}} チップは使用不可",
    "chip.vipCredits": "VIP",
  },
  ko: {
    "betting.clearBet": "초기화",
    "betting.clearBetLabel": "배팅 초기화 — 0으로 리셋",
    "betting.tableLimits": "테이블 한도",
    "betting.tableLimitsRange": "{{min}}–{{max}} 칩",
    "betting.tapToAdd": "배팅하려면 칩을 탭하세요",
    "chip.addLabel": "배팅에 {{amount}} 추가",
    "chip.disabledLabel": "{{amount}} 칩 사용 불가",
    "chip.vipCredits": "VIP",
  },
  nl: {
    "betting.clearBet": "Wissen",
    "betting.clearBetLabel": "Inzet wissen — terugzetten naar nul",
    "betting.tableLimits": "Tafellimiet",
    "betting.tableLimitsRange": "{{min}}–{{max}} chips",
    "betting.tapToAdd": "Tik chips om in te zetten",
    "chip.addLabel": "{{amount}} aan inzet toevoegen",
    "chip.disabledLabel": "{{amount}}-chip niet beschikbaar",
    "chip.vipCredits": "VIP",
  },
  pt: {
    "betting.clearBet": "Limpar",
    "betting.clearBetLabel": "Limpar aposta — redefinir para zero",
    "betting.tableLimits": "Limites da mesa",
    "betting.tableLimitsRange": "{{min}}–{{max}} fichas",
    "betting.tapToAdd": "Toque nas fichas para apostar",
    "chip.addLabel": "Adicionar {{amount}} à aposta",
    "chip.disabledLabel": "Ficha de {{amount}} indisponível",
    "chip.vipCredits": "VIP",
  },
  ru: {
    "betting.clearBet": "Сброс",
    "betting.clearBetLabel": "Сбросить ставку — обнулить",
    "betting.tableLimits": "Лимиты стола",
    "betting.tableLimitsRange": "{{min}}–{{max}} фишек",
    "betting.tapToAdd": "Нажмите фишки для ставки",
    "chip.addLabel": "Добавить {{amount}} к ставке",
    "chip.disabledLabel": "Фишка {{amount}} недоступна",
    "chip.vipCredits": "VIP",
  },
  zh: {
    "betting.clearBet": "清除",
    "betting.clearBetLabel": "清除下注 — 重置为零",
    "betting.tableLimits": "桌面限制",
    "betting.tableLimitsRange": "{{min}}–{{max}} 个",
    "betting.tapToAdd": "点击筹码下注",
    "chip.addLabel": "向下注添加 {{amount}}",
    "chip.disabledLabel": "{{amount}} 筹码不可用",
    "chip.vipCredits": "VIP",
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
