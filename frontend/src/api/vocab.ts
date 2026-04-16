/**
 * Shared vocabulary constants — DO NOT edit by hand.
 *
 * Source of truth: backend/vocab.py (GameOutcome enum).
 * To update: edit backend/vocab.py, then run:
 *   python backend/scripts/gen_vocab_ts.py > frontend/src/api/vocab.ts
 *
 * The backend CI test (tests/test_vocab.py) will fail if this file
 * drifts from the Python enum.
 */

export const GAME_OUTCOMES = [
  "win",
  "loss",
  "push",
  "blackjack",
  "completed",
  "abandoned",
  "kept_playing",
] as const;

export type GameOutcome = (typeof GAME_OUTCOMES)[number];
