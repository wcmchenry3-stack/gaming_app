import { solitaireApi } from "../api";

describe("solitaireApi — endpoints", () => {
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

  it("submitScore POSTs { player_name, score } to /solitaire/score", async () => {
    respondWith({ player_name: "Alice", score: 820, rank: 1 });
    await solitaireApi.submitScore("Alice", 820);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/solitaire/score"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ player_name: "Alice", score: 820 }),
      })
    );
  });

  it("submitScore returns the ScoreEntry from the response", async () => {
    respondWith({ player_name: "Alice", score: 820, rank: 4 });
    const entry = await solitaireApi.submitScore("Alice", 820);
    expect(entry).toEqual({ player_name: "Alice", score: 820, rank: 4 });
  });

  it("getLeaderboard GETs /solitaire/scores", async () => {
    respondWith({ scores: [] });
    await solitaireApi.getLeaderboard();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/solitaire/scores"),
      expect.any(Object)
    );
  });
});
