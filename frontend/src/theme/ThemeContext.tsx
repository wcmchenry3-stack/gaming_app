import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Theme = "dark" | "light";

export interface Colors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFilled: string;
  accent: string;
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

// --- Named color constants (Tailwind-aligned slate/blue scale) ---
const COLORS = {
  // Slate
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate850: "#162032", // custom intermediate
  slate900: "#0f172a",
  slate950: "#020617", // custom deepest dark
  // Blue
  blue100: "#dbeafe",
  blue400: "#60a5fa",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  // Semantic
  red400: "#f87171",
  red500: "#ef4444",
  green400: "#4ade80",
  green600: "#16a34a",
  white: "#ffffff",
} as const;

const dark: Colors = {
  background: COLORS.slate900,
  surface: COLORS.slate800,
  surfaceAlt: COLORS.slate850,
  border: COLORS.slate700,
  text: COLORS.slate100,
  textMuted: COLORS.slate400,
  textFilled: COLORS.slate600,
  accent: COLORS.blue600,
  potential: COLORS.blue400, // blue400 on slate800 ≈ 5.25:1 — passes WCAG AA
  heldBg: "#1e3a5f", // bespoke — no direct Tailwind match
  heldBorder: COLORS.blue500,
  dieBg: COLORS.slate800,
  dieBorder: COLORS.slate600,
  headerBg: COLORS.slate950,
  sectionHeaderBg: COLORS.slate900,
  bonusBg: COLORS.slate850,
  totalBg: COLORS.slate950,
  modalBg: COLORS.slate800,
  error: COLORS.red400,
  bonus: COLORS.green400,
  fruitContainer: COLORS.slate800,
  fruitBackground: COLORS.slate900,
};

const light: Colors = {
  background: COLORS.slate50,
  surface: COLORS.white,
  surfaceAlt: COLORS.slate100,
  border: COLORS.slate200,
  text: COLORS.slate800,
  textMuted: COLORS.slate500,
  textFilled: COLORS.slate400,
  accent: COLORS.blue600,
  potential: COLORS.blue600, // blue600 on white ≈ 4.71:1 — passes WCAG AA
  heldBg: COLORS.blue100,
  heldBorder: COLORS.blue600,
  dieBg: COLORS.white,
  dieBorder: COLORS.slate300,
  headerBg: COLORS.slate900,
  sectionHeaderBg: COLORS.slate800,
  bonusBg: COLORS.slate100,
  totalBg: COLORS.slate800,
  modalBg: COLORS.white,
  error: COLORS.red500,
  bonus: COLORS.green600,
  fruitContainer: COLORS.slate200,
  fruitBackground: COLORS.slate300, // was slate50 ≈ white; now clearly distinct from page bg
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
