/**
 * Shared types for the game module.
 *
 * These types are used by the offline score queue and (eventually) by
 * every game's API client and engine. See docs for the unified game module
 * pattern.
 */

export type GameType = "cascade" | "yacht" | "blackjack" | "twenty48" | "pachisi";

/**
 * A score submission waiting to be sent to the server.
 *
 * `id` is a client-generated UUID v4 that doubles as the `game_id`
 * idempotency key for backend dedupe (see issue #155). It is created
 * at enqueue time and never changes.
 */
export interface PendingSubmission {
  id: string;
  game_type: GameType;
  payload: Record<string, unknown>;
  played_at: string;
  attempts: number;
  last_error?: string;
}

/**
 * A handler that knows how to submit one queued item to the server.
 * Throwing from the handler keeps the item in the queue for a later retry.
 */
export type SubmitHandler = (item: PendingSubmission) => Promise<void>;
