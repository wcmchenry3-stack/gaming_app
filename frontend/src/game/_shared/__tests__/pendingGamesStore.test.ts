import AsyncStorage from "@react-native-async-storage/async-storage";

import { PendingGamesStore } from "../pendingGamesStore";

describe("PendingGamesStore", () => {
  let store: PendingGamesStore;

  beforeEach(async () => {
    await AsyncStorage.clear();
    store = new PendingGamesStore();
    await store.init();
  });

  it("creates a pending game with zero nextEventIndex", async () => {
    await store.create("g1", "yacht", { seat: 1 });
    const g = store.get("g1");
    expect(g).toBeDefined();
    expect(g?.gameType).toBe("yacht");
    expect(g?.metadata).toEqual({ seat: 1 });
    expect(g?.nextEventIndex).toBe(0);
    expect(g?.startedSynced).toBe(false);
    expect(g?.completed).toBe(false);
  });

  it("nextEventIndex returns sequential values", async () => {
    await store.create("g1", "yacht", {});
    expect(store.nextEventIndex("g1")).toBe(0);
    expect(store.nextEventIndex("g1")).toBe(1);
    expect(store.nextEventIndex("g1")).toBe(2);
  });

  it("nextEventIndex returns null for an unknown game", () => {
    expect(store.nextEventIndex("nope")).toBeNull();
  });

  it("nextEventIndex returns null for a completed game", async () => {
    await store.create("g1", "yacht", {});
    await store.complete("g1", { finalScore: 100 });
    expect(store.nextEventIndex("g1")).toBeNull();
  });

  it("complete is idempotent", async () => {
    await store.create("g1", "yacht", {});
    await store.complete("g1", { finalScore: 100 });
    await store.complete("g1", { finalScore: 999 });
    expect(store.get("g1")?.completeSummary?.finalScore).toBe(100);
  });

  it("rehydrates state on init after a fresh instance", async () => {
    await store.create("g1", "yacht", { k: "v" });
    store.nextEventIndex("g1");
    store.nextEventIndex("g1");
    await store.complete("g1", { finalScore: 500, outcome: "win" });
    // Wait a tick for the fire-and-forget persist() from nextEventIndex.
    await new Promise((r) => setTimeout(r, 10));

    const fresh = new PendingGamesStore();
    await fresh.init();
    const g = fresh.get("g1");
    expect(g?.gameType).toBe("yacht");
    expect(g?.nextEventIndex).toBe(2);
    expect(g?.completed).toBe(true);
    expect(g?.completeSummary).toEqual({ finalScore: 500, outcome: "win" });
  });

  it("forget drops the game", async () => {
    await store.create("g1", "yacht", {});
    await store.forget("g1");
    expect(store.get("g1")).toBeUndefined();
    expect(store.all()).toEqual([]);
  });

  it("markStartedSynced / markCompleteSynced flip the flags", async () => {
    await store.create("g1", "yacht", {});
    await store.markStartedSynced("g1");
    expect(store.get("g1")?.startedSynced).toBe(true);
    await store.markCompleteSynced("g1");
    expect(store.get("g1")?.completeSynced).toBe(true);
  });

  it("clearAll empties the map and disk", async () => {
    await store.create("g1", "yacht", {});
    await store.clearAll();
    expect(store.all()).toEqual([]);
    const fresh = new PendingGamesStore();
    await fresh.init();
    expect(fresh.all()).toEqual([]);
  });
});
