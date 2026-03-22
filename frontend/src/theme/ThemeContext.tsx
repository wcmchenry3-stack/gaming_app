import React, { createContext, useContext, useState } from "react";

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
}

const dark: Colors = {
  background: "#0f172a",
  surface: "#1e293b",
  surfaceAlt: "#162032",
  border: "#334155",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textFilled: "#475569",
  accent: "#3b82f6",
  heldBg: "#1e3a5f",
  heldBorder: "#3b82f6",
  dieBg: "#1e293b",
  dieBorder: "#475569",
  headerBg: "#020617",
  sectionHeaderBg: "#0f172a",
  bonusBg: "#162032",
  totalBg: "#020617",
  modalBg: "#1e293b",
  error: "#f87171",
  bonus: "#4ade80",
};

const light: Colors = {
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  border: "#e2e8f0",
  text: "#1e293b",
  textMuted: "#64748b",
  textFilled: "#94a3b8",
  accent: "#2563eb",
  heldBg: "#dbeafe",
  heldBorder: "#2563eb",
  dieBg: "#ffffff",
  dieBorder: "#cbd5e1",
  headerBg: "#0f172a",
  sectionHeaderBg: "#1e293b",
  bonusBg: "#f1f5f9",
  totalBg: "#1e293b",
  modalBg: "#ffffff",
  error: "#ef4444",
  bonus: "#16a34a",
};

const PALETTES = { dark, light };
const STORAGE_KEY = "yahtzee_theme";

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
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark";
    } catch {
      return "dark";
    }
  });

  function toggle() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
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
