/**
 * Pachisi API response shapes.
 */

import type { GameSession } from "../_shared/types";

export interface PieceResponse {
  index: number;
  position: number; // -1=base, 0-51=outer track, 52-57=red home col, 64-69=yellow home col, 100=finished
  is_home: boolean;
  is_finished: boolean;
}

export interface PlayerStateResponse {
  player_id: string;
  pieces: PieceResponse[];
  pieces_home: number;
  pieces_finished: number;
}

export interface PachisiState {
  phase: string; // "roll" | "move" | "game_over"
  players: string[];
  current_player: string;
  die_value: number | null;
  valid_moves: number[];
  player_states: PlayerStateResponse[];
  winner: string | null;
  extra_turn: boolean;
  cpu_player: string | null;
  last_event: string | null;
}

export type PachisiSession = GameSession<PachisiState>;
