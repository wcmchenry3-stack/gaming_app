/**
 * Mahjong's handler for flushing queued score submissions.
 *
 * Registered once at module load by NetworkContext. Keeps queue-flush
 * logic co-located with Mahjong rather than in a central switch.
 */

import { mahjongApi } from "./api";
import { scoreQueue } from "../_shared/scoreQueue";
import type { PendingSubmission } from "../_shared/types";

export function registerMahjongScoreHandler(): void {
  scoreQueue.registerHandler("mahjong", async (item: PendingSubmission) => {
    const { player_name, score } = item.payload as { player_name: string; score: number };
    if (typeof player_name !== "string" || typeof score !== "number") {
      // Malformed payload — drop by "succeeding" (throwing would retry forever).
      return;
    }
    await mahjongApi.submitScore(player_name, score);
  });
}
