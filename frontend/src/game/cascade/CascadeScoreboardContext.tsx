import React, { createContext, useContext, useState } from "react";

export interface CascadeScoreboardSnapshot {
  score: number;
  bestScore: number;
  bestFruitName: string;
  mergeCount: number;
  gamesPlayed: number;
  hasGame: boolean;
}

const initial: CascadeScoreboardSnapshot = {
  score: 0,
  bestScore: 0,
  bestFruitName: "—",
  mergeCount: 0,
  gamesPlayed: 0,
  hasGame: false,
};

interface ContextValue {
  snapshot: CascadeScoreboardSnapshot;
  setSnapshot: (s: CascadeScoreboardSnapshot) => void;
}

const CascadeScoreboardContext = createContext<ContextValue | null>(null);

export function CascadeScoreboardProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <CascadeScoreboardContext.Provider value={{ snapshot, setSnapshot }}>
      {children}
    </CascadeScoreboardContext.Provider>
  );
}

export function useCascadeScoreboard() {
  const ctx = useContext(CascadeScoreboardContext);
  if (!ctx) throw new Error("useCascadeScoreboard must be inside CascadeScoreboardProvider");
  return ctx;
}
