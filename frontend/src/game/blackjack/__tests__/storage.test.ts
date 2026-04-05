import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveGame, loadGame, clearGame } from "../storage";
import { newGame } from "../engine";

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
});
