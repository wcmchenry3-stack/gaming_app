import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  newGame,
  EngineState,
  DEFAULT_RULES,
} from "./engine";
import { GameRules } from "./types";
import { saveGame, loadGame, clearGame } from "./storage";

interface BlackjackGameContextValue {
  engine: EngineState | null;
  loading: boolean;
  error: string | null;
  apply: (fn: (s: EngineState) => EngineState) => void;
  handleRulesChange: (rules: GameRules) => void;
  handlePlayAgain: () => void;
}

const BlackjackGameContext = createContext<BlackjackGameContextValue | null>(null);

export function BlackjackGameProvider({ children }: { children: React.ReactNode }) {
  const [engine, setEngine] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadGame()
      .then((saved) => {
        if (!active) return;
        const next = saved ?? newGame();
        setEngine(next);
        if (!saved) saveGame(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Clear storage when player runs out of chips so relaunch starts fresh.
  useEffect(() => {
    if (engine && engine.chips === 0 && engine.phase === "result") {
      clearGame();
    }
  }, [engine]);

  const apply = useCallback(
    (fn: (s: EngineState) => EngineState) => {
      if (!engine) return;
      setError(null);
      try {
        const next = fn(engine);
        setEngine(next);
        saveGame(next);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine]
  );

  const handleRulesChange = useCallback(
    (rules: GameRules) => {
      if (!engine || engine.phase !== "betting") return;
      const updated: EngineState = {
        ...newGame(undefined, rules),
        chips: engine.chips,
      };
      setEngine(updated);
      saveGame(updated);
    },
    [engine]
  );

  const handlePlayAgain = useCallback(() => {
    const fresh = newGame(undefined, engine?.rules ?? DEFAULT_RULES);
    setEngine(fresh);
    saveGame(fresh);
    setError(null);
  }, [engine]);

  return (
    <BlackjackGameContext.Provider
      value={{ engine, loading, error, apply, handleRulesChange, handlePlayAgain }}
    >
      {children}
    </BlackjackGameContext.Provider>
  );
}

export function useBlackjackGame(): BlackjackGameContextValue {
  const ctx = useContext(BlackjackGameContext);
  if (!ctx) throw new Error("useBlackjackGame must be used within BlackjackGameProvider");
  return ctx;
}
