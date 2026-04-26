import React from "react";

// Factories are held separately so prefetch callers can invoke the same
// import() as React.lazy — the module loader dedupes, so once prefetched the
// React.lazy promise resolves synchronously on navigation.
const factories = {
  Cascade: () => import("../screens/CascadeScreen"),
  BlackjackBetting: () => import("../screens/BlackjackBettingScreen"),
  BlackjackTable: () => import("../screens/BlackjackTableScreen"),
  Twenty48: () => import("../screens/Twenty48Screen"),
  Solitaire: () => import("../screens/SolitaireScreen"),
  FreeCell: () => import("../screens/FreeCellScreen"),
  Hearts: () => import("../screens/HeartsScreen"),
  Sudoku: () => import("../screens/SudokuScreen"),
  Leaderboard: () => import("../screens/LeaderboardScreen"),
  GameDetail: () => import("../screens/GameDetailScreen"),
  Settings: () => import("../screens/SettingsScreen"),
  Scoreboard: () => import("../screens/ScoreboardScreen"),
} as const;

export const LazyScreens = {
  Cascade: React.lazy(factories.Cascade),
  BlackjackBetting: React.lazy(factories.BlackjackBetting),
  BlackjackTable: React.lazy(factories.BlackjackTable),
  Twenty48: React.lazy(factories.Twenty48),
  Solitaire: React.lazy(factories.Solitaire),
  FreeCell: React.lazy(factories.FreeCell),
  Hearts: React.lazy(factories.Hearts),
  Sudoku: React.lazy(factories.Sudoku),
  Leaderboard: React.lazy(factories.Leaderboard),
  GameDetail: React.lazy(factories.GameDetail),
  Settings: React.lazy(factories.Settings),
  Scoreboard: React.lazy(factories.Scoreboard),
} as const;

/**
 * Fire-and-forget prefetch of lobby game chunks. Called from HomeScreen after
 * interactions settle so the Suspense fallback doesn't flash when the user
 * taps into a game (issue #706). Safe to call multiple times — the module
 * loader dedupes.
 */
export function prefetchLobbyGameScreens(): void {
  factories.Cascade().catch(() => undefined);
  factories.BlackjackBetting().catch(() => undefined);
  factories.Twenty48().catch(() => undefined);
  factories.Solitaire().catch(() => undefined);
  factories.FreeCell().catch(() => undefined);
  factories.Hearts().catch(() => undefined);
  factories.Sudoku().catch(() => undefined);
}
