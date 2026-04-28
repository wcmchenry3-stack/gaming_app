/**
 * Per-device session ID management.
 *
 * Every game sends its session ID as the `X-Session-ID` header so the
 * backend can isolate game state per client without requiring user
 * accounts. The ID is generated once per device and persisted in
 * AsyncStorage.
 *
 * This used to live in the Yacht client (`frontend/src/api/client.ts`)
 * which all other clients reached into. Moved to _shared during the
 * unified game module refactor (#153).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "game_session_id";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; // codeql[js/insecure-randomness]
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getOrCreateSessionId(): Promise<string> {
  let sid = await AsyncStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = generateUUID();
    await AsyncStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}
