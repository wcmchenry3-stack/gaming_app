/**
 * Cascade's handler for flushing queued score submissions.
 *
 * Registered once at module load by NetworkContext. Keeps queue-flush
 * logic co-located with Cascade rather than in a central switch.
 */

import { cascadeApi } from "./api";
import { scoreQueue } from "../_shared/scoreQueue";
import { PendingSubmission } from "../_shared/types";

export function registerCascadeScoreHandler(): void {
  scoreQueue.registerHandler("cascade", async (item: PendingSubmission) => {
    const { game_id, player_name } = item.payload as { game_id: string; player_name: string };
    if (typeof game_id !== "string" || typeof player_name !== "string") {
      // Malformed payload — drop by "succeeding" (throwing would keep retrying forever).
      return;
    }
    await cascadeApi.submitPlayerName(game_id, player_name);
  });
}
