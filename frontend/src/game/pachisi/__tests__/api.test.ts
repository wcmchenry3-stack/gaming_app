import { pachisiApi } from "../api";

describe("pachisiApi — endpoints", () => {
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

  it("newSession POSTs to /pachisi/new", async () => {
    respondWith({ phase: "roll" });
    await pachisiApi.newSession();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/pachisi/new"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getState GETs /pachisi/state", async () => {
    respondWith({ phase: "roll" });
    await pachisiApi.getState();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/pachisi/state"),
      expect.any(Object)
    );
  });

  it("roll POSTs to /pachisi/roll", async () => {
    respondWith({ phase: "move", die_value: 4 });
    await pachisiApi.roll();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/pachisi/roll"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("move POSTs piece_index to /pachisi/move", async () => {
    respondWith({ phase: "roll" });
    await pachisiApi.move(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/pachisi/move"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ piece_index: 2 }),
      })
    );
  });

  it("newGame POSTs to /pachisi/new-game", async () => {
    respondWith({ phase: "roll" });
    await pachisiApi.newGame();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/pachisi/new-game"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
