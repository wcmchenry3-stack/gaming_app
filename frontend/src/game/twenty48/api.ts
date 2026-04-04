/**
 * Twenty48 API client.
 */

import { createGameClient } from "../_shared/httpClient";
import { Twenty48State } from "./types";

const request = createGameClient({ apiTag: "twenty48" });

export const twenty48Api = {
  newSession: () => request<Twenty48State>("/twenty48/new", { method: "POST" }),

  getState: () => request<Twenty48State>("/twenty48/state"),

  move: (direction: string) =>
    request<Twenty48State>("/twenty48/move", {
      method: "POST",
      body: JSON.stringify({ direction }),
    }),
};

// Re-export types for import-site convenience.
export type { Twenty48State } from "./types";
