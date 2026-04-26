import { mahjongApi } from "../api";

describe("mahjongApi — endpoints", () => {
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

  it("submitScore POSTs { player_name, score } to /mahjong/score", async () => {
    respondWith({ player_name: "Alice", score: 820, rank: 1 });
    await mahjongApi.submitScore("Alice", 820);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/mahjong/score"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ player_name: "Alice", score: 820 }),
      })
    );
  });

  it("submitScore returns the ScoreEntry from the response", async () => {
    respondWith({ player_name: "Alice", score: 820, rank: 4 });
    const entry = await mahjongApi.submitScore("Alice", 820);
    expect(entry).toEqual({ player_name: "Alice", score: 820, rank: 4 });
  });

  it("getLeaderboard GETs /mahjong/scores", async () => {
    respondWith({ scores: [] });
    await mahjongApi.getLeaderboard();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/mahjong/scores"),
      expect.any(Object)
    );
  });

  it("getLeaderboard returns the scores array", async () => {
    const scores = [{ player_name: "Bob", score: 1200, rank: 1 }];
    respondWith({ scores });
    const result = await mahjongApi.getLeaderboard();
    expect(result).toEqual({ scores });
  });
});
