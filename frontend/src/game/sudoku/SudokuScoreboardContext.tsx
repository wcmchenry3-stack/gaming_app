import React, { createContext, useContext, useState } from "react";
import type { Difficulty } from "./types";

export interface SudokuScoreboardSnapshot {
  elapsed: number;
  difficulty: Difficulty;
  errorCount: number;
  hasGame: boolean;
}

const initial: SudokuScoreboardSnapshot = {
  elapsed: 0,
  difficulty: "easy",
  errorCount: 0,
  hasGame: false,
};

interface ContextValue {
  snapshot: SudokuScoreboardSnapshot;
  setSnapshot: (s: SudokuScoreboardSnapshot) => void;
}

const SudokuScoreboardContext = createContext<ContextValue | null>(null);

export function SudokuScoreboardProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <SudokuScoreboardContext.Provider value={{ snapshot, setSnapshot }}>
      {children}
    </SudokuScoreboardContext.Provider>
  );
}

export function useSudokuScoreboard() {
  const ctx = useContext(SudokuScoreboardContext);
  if (!ctx) throw new Error("useSudokuScoreboard must be inside SudokuScoreboardProvider");
  return ctx;
}
