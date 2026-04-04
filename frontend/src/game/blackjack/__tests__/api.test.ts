import { blackjackApi } from "../api";

describe("blackjackApi — endpoints", () => {
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

  it("newSession POSTs to /blackjack/new", async () => {
    respondWith({ phase: "betting" });
    await blackjackApi.newSession();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/blackjack/new"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getState GETs /blackjack/state", async () => {
    respondWith({ phase: "betting" });
    await blackjackApi.getState();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/blackjack/state"),
      expect.any(Object)
    );
  });

  it("placeBet POSTs amount to /blackjack/bet", async () => {
    respondWith({ phase: "player" });
    await blackjackApi.placeBet(100);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/blackjack/bet"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 100 }),
      })
    );
  });

  it("hit POSTs to /blackjack/hit", async () => {
    respondWith({ phase: "player" });
    await blackjackApi.hit();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/blackjack/hit"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("stand POSTs to /blackjack/stand", async () => {
    respondWith({ phase: "result" });
    await blackjackApi.stand();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/blackjack/stand"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("doubleDown POSTs to /blackjack/double-down", async () => {
    respondWith({ phase: "result" });
    await blackjackApi.doubleDown();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/blackjack/double-down"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("newHand POSTs to /blackjack/new-hand", async () => {
    respondWith({ phase: "betting" });
    await blackjackApi.newHand();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/blackjack/new-hand"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
