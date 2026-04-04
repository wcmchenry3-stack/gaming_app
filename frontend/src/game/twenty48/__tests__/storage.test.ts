import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveGame, loadGame, clearGame } from "../storage";
import { Twenty48State } from "../types";

const sample: Twenty48State = {
  board: [
    [2, 0, 0, 0],
    [0, 4, 0, 0],
    [0, 0, 8, 0],
    [0, 0, 0, 16],
  ],
  score: 120,
  game_over: false,
  has_won: false,
};

describe("twenty48 storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("saves and loads a game", async () => {
    await saveGame(sample);
    const loaded = await loadGame();
    expect(loaded).toEqual(sample);
  });

  it("returns null when no saved game exists", async () => {
    const loaded = await loadGame();
    expect(loaded).toBeNull();
  });

  it("returns null when saved data is corrupted", async () => {
    await AsyncStorage.setItem("twenty48_game_v1", "not json");
    const loaded = await loadGame();
    expect(loaded).toBeNull();
  });

  it("returns null when saved data has a different shape", async () => {
    await AsyncStorage.setItem("twenty48_game_v1", JSON.stringify({ foo: "bar" }));
    const loaded = await loadGame();
    expect(loaded).toBeNull();
  });

  it("clearGame removes the saved state", async () => {
    await saveGame(sample);
    await clearGame();
    expect(await loadGame()).toBeNull();
  });
});
