import { ludoApi } from "../ludoClient";

describe("ludoApi endpoints", () => {
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

  it("throws Error with detail when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ detail: "No active game" }),
    } as Response);
    await expect(ludoApi.getState()).rejects.toThrow("No active game");
  });

  it("falls back to statusText when error body has no detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("parse error")),
    } as Response);
    await expect(ludoApi.getState()).rejects.toThrow("Internal Server Error");
  });
});

// ---------------------------------------------------------------------------
// BASE_URL configuration — guards against the property: host regression
// where Render injects a bare internal hostname (e.g. "gaming-app-api") that
// resolves only inside Render's network, not from user browsers.
// ---------------------------------------------------------------------------
describe("ludoApi BASE_URL configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ phase: "roll" }),
    } as Response);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses EXPO_PUBLIC_API_URL when it is a full https URL", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://dev-games-api.buffingchi.com";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ludoApi: api } = require("../ludoClient") as typeof import("../ludoClient");
    await api.newSession();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining("https://dev-games-api.buffingchi.com"),
      expect.any(Object)
    );
  });

  it("prepends https:// when EXPO_PUBLIC_API_URL has no protocol", async () => {
    process.env.EXPO_PUBLIC_API_URL = "dev-games-api.buffingchi.com";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ludoApi: api } = require("../ludoClient") as typeof import("../ludoClient");
    await api.newSession();
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^https:\/\/dev-games-api\.buffingchi\.com/);
  });

  it("falls back to http://localhost:8000 when EXPO_PUBLIC_API_URL is not set", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ludoApi: api } = require("../ludoClient") as typeof import("../ludoClient");
    await api.newSession();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:8000"),
      expect.any(Object)
    );
  });
});
