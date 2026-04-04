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
  // crypto.randomUUID() is only available in browsers, not Hermes (React Native).
  // Fall back to a manual UUID v4 using Math.random().
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
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
