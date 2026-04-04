/**
 * Cascade's handler for flushing queued score submissions.
 *
 * Registered once at module load by NetworkContext. Keeps queue-flush
 * logic co-located with Cascade rather than in a central switch.
 */

import { cascadeApi } from "../../api/cascadeClient";
import { scoreQueue } from "../_shared/scoreQueue";
import { PendingSubmission } from "../_shared/types";

export function registerCascadeScoreHandler(): void {
  scoreQueue.registerHandler("cascade", async (item: PendingSubmission) => {
    const { player_name, score } = item.payload as { player_name: string; score: number };
    if (typeof player_name !== "string" || typeof score !== "number") {
      // Malformed payload — drop by "succeeding" (throwing would keep retrying forever).
      return;
    }
    // Backend idempotency (passing item.id as game_id) is tracked in #155.
    // For now we submit using the existing contract.
    await cascadeApi.submitScore(player_name, score);
  });
}
