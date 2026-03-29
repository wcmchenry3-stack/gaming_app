// Gesture handler requires native setup in Jest
import "react-native-gesture-handler/jestSetup";

// AsyncStorage mock (replaces localStorage in ThemeContext / FruitSetContext)
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// English namespace fixtures for testing
import common from "./src/i18n/locales/en/common.json";
import yahtzee from "./src/i18n/locales/en/yahtzee.json";
import fruitMerge from "./src/i18n/locales/en/fruit-merge.json";
import errors from "./src/i18n/locales/en/errors.json";
import blackjack from "./src/i18n/locales/en/blackjack.json";
import ludo from "./src/i18n/locales/en/ludo.json";

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  ns: ["common", "yahtzee", "fruit-merge", "errors", "blackjack", "ludo"],
  defaultNS: "common",
  resources: {
    en: {
      common,
      yahtzee,
      "fruit-merge": fruitMerge,
      errors,
      blackjack,
      ludo,
    },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
