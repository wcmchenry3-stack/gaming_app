import React, { createContext, useContext, useState } from "react";

export interface MahjongScoreboardSnapshot {
  score: number;
  pairsRemoved: number;
  shufflesLeft: number;
  elapsedMs: number;
  hasGame: boolean;
  bestScore: number;
  bestTimeMs: number;
  gamesPlayed: number;
  gamesWon: number;
}

const initial: MahjongScoreboardSnapshot = {
  score: 0,
  pairsRemoved: 0,
  shufflesLeft: 3,
  elapsedMs: 0,
  hasGame: false,
  bestScore: 0,
  bestTimeMs: 0,
  gamesPlayed: 0,
  gamesWon: 0,
};

interface ContextValue {
  snapshot: MahjongScoreboardSnapshot;
  setSnapshot: (s: MahjongScoreboardSnapshot) => void;
}

const MahjongScoreboardContext = createContext<ContextValue | null>(null);

export function MahjongScoreboardProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <MahjongScoreboardContext.Provider value={{ snapshot, setSnapshot }}>
      {children}
    </MahjongScoreboardContext.Provider>
  );
}

export function useMahjongScoreboard() {
  const ctx = useContext(MahjongScoreboardContext);
  if (!ctx) throw new Error("useMahjongScoreboard must be inside MahjongScoreboardProvider");
  return ctx;
}
