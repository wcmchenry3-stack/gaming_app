import React, { createContext, useContext, useState } from "react";

export interface Twenty48ScoreboardSnapshot {
  score: number;
  bestTile: number;
  moveCount: number;
  bestScore: number;
  hasGame: boolean;
  allTimeBestTile: number;
  gamesPlayed: number;
  gamesWon: number;
}

const initial: Twenty48ScoreboardSnapshot = {
  score: 0,
  bestTile: 0,
  moveCount: 0,
  bestScore: 0,
  hasGame: false,
  allTimeBestTile: 0,
  gamesPlayed: 0,
  gamesWon: 0,
};

interface ContextValue {
  snapshot: Twenty48ScoreboardSnapshot;
  setSnapshot: (s: Twenty48ScoreboardSnapshot) => void;
}

const Twenty48ScoreboardContext = createContext<ContextValue | null>(null);

export function Twenty48ScoreboardProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <Twenty48ScoreboardContext.Provider value={{ snapshot, setSnapshot }}>
      {children}
    </Twenty48ScoreboardContext.Provider>
  );
}

export function useTwenty48Scoreboard() {
  const ctx = useContext(Twenty48ScoreboardContext);
  if (!ctx) throw new Error("useTwenty48Scoreboard must be inside Twenty48ScoreboardProvider");
  return ctx;
}
