import { api } from "../api";

describe("yacht api — endpoints", () => {
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

  it("newGame POSTs to /game/new", async () => {
    respondWith({ dice: [1, 2, 3, 4, 5] });
    await api.newGame();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/game/new"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getState GETs /game/state", async () => {
    respondWith({ dice: [1, 1, 1, 1, 1] });
    await api.getState();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/game/state"),
      expect.any(Object)
    );
  });

  it("roll POSTs held array to /game/roll", async () => {
    const held = [true, false, true, false, false];
    respondWith({ dice: [1, 2, 3, 4, 5] });
    await api.roll(held);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/game/roll"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ held }),
      })
    );
  });

  it("score POSTs category to /game/score", async () => {
    respondWith({ dice: [1, 2, 3, 4, 5] });
    await api.score("ones");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/game/score"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ category: "ones" }),
      })
    );
  });

  it("possibleScores GETs /game/possible-scores", async () => {
    respondWith({ possible_scores: { ones: 3 } });
    await api.possibleScores();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/game/possible-scores"),
      expect.any(Object)
    );
  });
});
