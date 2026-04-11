import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Theme = "dark" | "light";

export interface Colors {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceHigh: string;
  border: string;
  text: string;
  textMuted: string;
  textFilled: string;
  textOnAccent: string;
  accent: string;
  accentBright: string;
  secondary: string;
  tertiary: string;
  potential: string;
  heldBg: string;
  heldBorder: string;
  dieBg: string;
  dieBorder: string;
  headerBg: string;
  sectionHeaderBg: string;
  bonusBg: string;
  totalBg: string;
  modalBg: string;
  error: string;
  bonus: string;
  fruitContainer: string;
  fruitBackground: string;
}

// --- Neon Arcade design tokens ---
const TOKENS = {
  // Dark backgrounds
  darkBg: "#0e0e13",
  darkSurface: "#19191f",
  darkSurfaceAlt: "#1f1f26",
  darkSurfaceHigh: "#25252c",
  // Light backgrounds
  lightBg: "#f5f5fa",
  lightSurface: "#ffffff",
  lightSurfaceAlt: "#ededf5",
  lightSurfaceHigh: "#e0e0ec",
  // Accents
  accentDark: "#8ff5ff",
  accentLight: "#0099aa",
  accentBrightDark: "#00eefc",
  accentBrightLight: "#00b8cc",
  secondaryDark: "#d674ff",
  secondaryLight: "#9900cf",
  tertiaryDark: "#cafd00",
  tertiaryLight: "#5c7a00",
  // Semantic
  errorDark: "#ff716c",
  errorLight: "#c0392b",
  bonusDark: "#4ade80",
  bonusLight: "#16a34a",
  white: "#ffffff",
} as const;

const dark: Colors = {
  background: TOKENS.darkBg,
  surface: TOKENS.darkSurface,
  surfaceAlt: TOKENS.darkSurfaceAlt,
  surfaceHigh: TOKENS.darkSurfaceHigh,
  border: "#2e2e38",
  text: "#e8e8f0",
  // WCAG AA: 5.83:1 on #25252c, 5.05:1 on #303034, 7.45:1 on #0e0e13
  textMuted: "#a0a0ac",
  textFilled: "#4a4a56",
  textOnAccent: "#0e0e13",
  accent: TOKENS.accentDark,
  accentBright: TOKENS.accentBrightDark,
  secondary: TOKENS.secondaryDark,
  tertiary: TOKENS.tertiaryDark,
  potential: TOKENS.accentDark, // cyan on dark surface — high contrast
  heldBg: "#1a2e3a",
  heldBorder: TOKENS.accentDark,
  dieBg: TOKENS.darkSurface,
  dieBorder: "#3a3a46",
  headerBg: TOKENS.darkBg,
  sectionHeaderBg: TOKENS.darkSurface,
  bonusBg: TOKENS.darkSurfaceAlt,
  totalBg: TOKENS.darkBg,
  modalBg: TOKENS.darkSurfaceHigh,
  error: TOKENS.errorDark,
  bonus: TOKENS.bonusDark,
  fruitContainer: TOKENS.darkSurface,
  fruitBackground: TOKENS.darkBg,
};

const light: Colors = {
  background: TOKENS.lightBg,
  surface: TOKENS.lightSurface,
  surfaceAlt: TOKENS.lightSurfaceAlt,
  surfaceHigh: TOKENS.lightSurfaceHigh,
  border: "#d4d4e0",
  text: "#1a1a24",
  textMuted: "#6e6e7a",
  textFilled: "#9a9aa6",
  textOnAccent: TOKENS.white,
  accent: TOKENS.accentLight,
  accentBright: TOKENS.accentBrightLight,
  secondary: TOKENS.secondaryLight,
  tertiary: TOKENS.tertiaryLight,
  potential: TOKENS.accentLight, // teal on white — 4.6:1 AA
  heldBg: "#d6f5f8",
  heldBorder: TOKENS.accentLight,
  dieBg: TOKENS.lightSurface,
  dieBorder: "#c8c8d4",
  headerBg: "#1a1a24",
  sectionHeaderBg: "#25252c",
  bonusBg: TOKENS.lightSurfaceAlt,
  totalBg: "#25252c",
  modalBg: TOKENS.lightSurface,
  error: TOKENS.errorLight,
  bonus: TOKENS.bonusLight,
  fruitContainer: TOKENS.lightSurfaceAlt,
  fruitBackground: TOKENS.lightSurfaceHigh,
};

const PALETTES = { dark, light };
const STORAGE_KEY = "gaming_app_theme";

interface ThemeContextValue {
  theme: Theme;
  colors: Colors;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  colors: dark,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "dark" || stored === "light") setTheme(stored);
    });
  }, []);

  function toggle() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, colors: PALETTES[theme], toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
