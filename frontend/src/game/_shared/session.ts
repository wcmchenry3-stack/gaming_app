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
  // Fallback using crypto.getRandomValues (supported in React Native ≥ 0.65 / Hermes ≥ 0.9)
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function getOrCreateSessionId(): Promise<string> {
  let sid = await AsyncStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = generateUUID();
    await AsyncStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}
