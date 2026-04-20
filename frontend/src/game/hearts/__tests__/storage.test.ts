import AsyncStorage from "@react-native-async-storage/async-storage";
import { dealGame } from "../engine";
import { clearGame, loadGame, saveGame } from "../storage";
import type { HeartsState } from "../types";

describe("hearts storage", () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("saveGame serialises state to AsyncStorage", async () => {
    const state = dealGame();
    await saveGame(state);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("hearts_game", JSON.stringify(state));
  });

  it("loadGame returns null when no key exists", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    expect(await loadGame()).toBeNull();
  });

  it("loadGame returns parsed state for valid payload", async () => {
    const state = dealGame();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(state));
    const loaded = await loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded?._v).toBe(1);
    expect(loaded?.phase).toBe(state.phase);
  });

  it("loadGame returns null and removes key for corrupt JSON", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("{not valid json");
    expect(await loadGame()).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("hearts_game");
  });

  it("loadGame returns null and removes key when _v is wrong", async () => {
    const bad = { ...dealGame(), _v: 99 };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(bad));
    expect(await loadGame()).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("hearts_game");
  });

  it("loadGame returns null for missing required arrays", async () => {
    const bad: Partial<HeartsState> = { _v: 1 };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(bad));
    expect(await loadGame()).toBeNull();
  });

  it("clearGame removes the storage key", async () => {
    await clearGame();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("hearts_game");
  });
});
