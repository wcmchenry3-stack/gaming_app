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
  overlay: string;
  /** Translucent panel colour for blurred header + tabbar chrome. */
  chromeBg: string;
  /** CSS-shorthand shadow spec for the header/tabbar glow (`offsetX offsetY blur rgba`). */
  chromeShadow: string;
  error: string;
  bonus: string;
  fruitContainer: string;
  fruitBackground: string;
}

// --- BC Arcade design tokens (see docs/BRANDING.md, issue #709) ---
// Dark values mirror colors_and_type.css; light values mirror the cream
// SharedComponents.jsx palette (cream supersedes the gray light variant).
const TOKENS = {
  // Dark backgrounds
  darkBg: "#0e0e13",
  darkSurface: "#19191f",
  darkSurfaceAlt: "#1f1f26",
  darkSurfaceHigh: "#25252c",
  // Light backgrounds (cream)
  lightBg: "#f5ecd7",
  lightSurface: "#fbf4e2",
  lightSurfaceAlt: "#eddfbf",
  lightSurfaceHigh: "#fff8e8",
  // Accents — light variants desaturated so they don't vibrate on cream
  accentDark: "#8ff5ff",
  accentLight: "#1bc5d4",
  accentBrightDark: "#00eefc",
  accentBrightLight: "#00a8b8",
  secondaryDark: "#d674ff",
  secondaryLight: "#a34fc4",
  tertiaryDark: "#cafd00",
  tertiaryLight: "#8fa800",
  // Semantic
  errorDark: "#ff716c",
  errorLight: "#d94a42",
  bonusDark: "#4ade80",
  bonusLight: "#2da557",
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
  overlay: "rgba(0,0,0,0.75)",
  chromeBg: "rgba(14,14,19,0.7)",
  chromeShadow: "0 4px 20px rgba(143,245,255,0.08)",
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
  border: "#d8c9a6",
  text: "#1a1412",
  textMuted: "#6b5e4a",
  textFilled: "#b5a684",
  textOnAccent: "#0e0e13", // dark text on teal accent (readable on cream variant)
  accent: TOKENS.accentLight,
  accentBright: TOKENS.accentBrightLight,
  secondary: TOKENS.secondaryLight,
  tertiary: TOKENS.tertiaryLight,
  potential: TOKENS.accentLight, // desaturated teal on cream
  heldBg: "#d7eff2", // cream-compatible light teal tint for highlighted dice
  heldBorder: TOKENS.accentLight,
  dieBg: TOKENS.lightSurface,
  dieBorder: "#d8c9a6",
  headerBg: "#1a1412", // dark header over cream body — existing screen contract
  sectionHeaderBg: "#25252c",
  bonusBg: TOKENS.lightSurfaceAlt,
  totalBg: "#25252c",
  modalBg: TOKENS.lightSurface,
  overlay: "rgba(0,0,0,0.75)",
  chromeBg: "rgba(245,236,215,0.82)",
  chromeShadow: "0 4px 20px rgba(0,0,0,0.06)",
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
