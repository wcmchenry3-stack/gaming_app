import { ludoApi } from "../api";

describe("ludoApi — endpoints", () => {
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

  it("newSession POSTs to /ludo/new", async () => {
    respondWith({ phase: "roll" });
    await ludoApi.newSession();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/ludo/new"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getState GETs /ludo/state", async () => {
    respondWith({ phase: "roll" });
    await ludoApi.getState();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/ludo/state"),
      expect.any(Object)
    );
  });

  it("roll POSTs to /ludo/roll", async () => {
    respondWith({ phase: "move", die_value: 4 });
    await ludoApi.roll();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/ludo/roll"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("move POSTs piece_index to /ludo/move", async () => {
    respondWith({ phase: "roll" });
    await ludoApi.move(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/ludo/move"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ piece_index: 2 }),
      })
    );
  });

  it("newGame POSTs to /ludo/new-game", async () => {
    respondWith({ phase: "roll" });
    await ludoApi.newGame();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/ludo/new-game"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
