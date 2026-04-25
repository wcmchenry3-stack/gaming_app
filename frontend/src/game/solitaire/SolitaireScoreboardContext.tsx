import React, { createContext, useContext, useState } from "react";

export interface SolitaireScoreboardSnapshot {
  moves: number;
  foundationsComplete: number;
  hasGame: boolean;
}

const initial: SolitaireScoreboardSnapshot = {
  moves: 0,
  foundationsComplete: 0,
  hasGame: false,
};

interface ContextValue {
  snapshot: SolitaireScoreboardSnapshot;
  setSnapshot: (s: SolitaireScoreboardSnapshot) => void;
}

const SolitaireScoreboardContext = createContext<ContextValue | null>(null);

export function SolitaireScoreboardProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <SolitaireScoreboardContext.Provider value={{ snapshot, setSnapshot }}>
      {children}
    </SolitaireScoreboardContext.Provider>
  );
}

export function useSolitaireScoreboard() {
  const ctx = useContext(SolitaireScoreboardContext);
  if (!ctx) throw new Error("useSolitaireScoreboard must be inside SolitaireScoreboardProvider");
  return ctx;
}
