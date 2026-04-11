import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveGame, loadGame, clearGame } from "../storage";
import { newGame, EngineState } from "../engine";

const STORAGE_KEY = "blackjack_game_v2";

describe("blackjack storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("saves and loads a game", async () => {
    const g = newGame();
    await saveGame(g);
    const loaded = await loadGame();
    expect(loaded).toEqual(g);
  });

  it("returns null when no saved game exists", async () => {
    expect(await loadGame()).toBeNull();
  });

  it("returns null when saved data is corrupted", async () => {
    await AsyncStorage.setItem("blackjack_game_v1", "not json");
    expect(await loadGame()).toBeNull();
  });

  it("returns null when saved data has different shape", async () => {
    await AsyncStorage.setItem("blackjack_game_v1", JSON.stringify({ foo: "bar" }));
    expect(await loadGame()).toBeNull();
  });

  it("clearGame removes the saved state", async () => {
    await saveGame(newGame());
    await clearGame();
    expect(await loadGame()).toBeNull();
  });

  it("persists lastWin across save/load", async () => {
    const g = newGame();
    const withLastWin: EngineState = { ...g, lastWin: 150 };
    await saveGame(withLastWin);
    const loaded = await loadGame();
    expect(loaded?.lastWin).toBe(150);
  });

  it("backfills lastWin as null for saves that predate the HUD feature", async () => {
    const g = newGame();
    // Simulate an old save without lastWin by serializing then deleting the key
    const serialized = JSON.parse(JSON.stringify(g)) as Record<string, unknown>;
    delete serialized["lastWin"];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    const loaded = await loadGame();
    expect(loaded?.lastWin).toBeNull();
  });
});
