import { cascadeApi } from "../api";

describe("cascadeApi — endpoints", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  function respondWith<T>(data: T, ok = true) {
    mockFetch.mockResolvedValueOnce({
      ok,
      statusText: "Bad Request",
      json: () => Promise.resolve(data),
    } as Response);
  }

  it("submitPlayerName PATCHes player_name to /cascade/score/:gameId", async () => {
    respondWith({ player_name: "Alice", score: 500, rank: 1 });
    await cascadeApi.submitPlayerName("game-abc-123", "Alice");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/cascade/score/game-abc-123"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ player_name: "Alice" }),
      })
    );
  });

  it("submitPlayerName returns rank from response", async () => {
    respondWith({ player_name: "Alice", score: 500, rank: 3 });
    const entry = await cascadeApi.submitPlayerName("game-abc-123", "Alice");
    expect(entry.rank).toBe(3);
  });

  it("getLeaderboard GETs /cascade/scores", async () => {
    respondWith({ scores: [] });
    await cascadeApi.getLeaderboard();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/cascade/scores"),
      expect.any(Object)
    );
  });
});
