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

  it("submitScore POSTs player_name and score to /cascade/score", async () => {
    respondWith({ player_name: "Alice", score: 500 });
    await cascadeApi.submitScore("Alice", 500);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/cascade/score"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ player_name: "Alice", score: 500 }),
      })
    );
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
