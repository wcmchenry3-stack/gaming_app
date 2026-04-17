/**
 * Twenty48 state types.
 */

import type { GameOutcome, GameSession } from "../_shared/types";

export interface TileData {
  id: number;
  value: number;
  row: number;
  col: number;
  /** null = newly spawned this turn (no slide animation) */
  prevRow: number | null;
  prevCol: number | null;
  /** true = spawned this turn — triggers scale-in animation */
  isNew: boolean;
  /** true = result of a merge this turn — triggers pop animation */
  isMerge: boolean;
}

export interface Twenty48State {
  board: number[][];
  tiles: TileData[];
  score: number;
  /** Points gained on the most recent move (drives score-delta flash). */
  scoreDelta: number;
  game_over: boolean;
  has_won: boolean;
  /** Timestamp (Date.now()) when the current play session started; null if not yet started or game is over. */
  startedAt: number | null;
  /** Total elapsed milliseconds accumulated across all sessions before the current one. */
  accumulatedMs: number;
}

export type Twenty48Session = GameSession<Twenty48State>;

/** Outcome for a completed Twenty48 game. */
export interface Twenty48Outcome extends GameOutcome {
  /** Whether the player reached the 2048 tile. */
  hasWon: boolean;
}
