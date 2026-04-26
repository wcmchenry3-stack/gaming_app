/**
 * Sudoku's handler for flushing queued score submissions.
 *
 * Registered once at module load by NetworkContext. Keeps queue-flush
 * logic co-located with Sudoku rather than in a central switch.
 */

import { sudokuApi } from "./api";
import { scoreQueue } from "../_shared/scoreQueue";
import type { PendingSubmission } from "../_shared/types";
import type { Difficulty, Variant } from "./types";

export function registerSudokuScoreHandler(): void {
  scoreQueue.registerHandler("sudoku", async (item: PendingSubmission) => {
    const { player_name, score, difficulty, variant } = item.payload as {
      player_name: string;
      score: number;
      difficulty: Difficulty;
      variant?: Variant;
    };
    if (
      typeof player_name !== "string" ||
      typeof score !== "number" ||
      typeof difficulty !== "string"
    ) {
      // Malformed payload — drop by "succeeding" (throwing would retry forever).
      return;
    }
    await sudokuApi.submitScore(player_name, score, difficulty, variant ?? "classic");
  });
}
