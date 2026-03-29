import { api } from "../client";

describe("api client", () => {
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

  it("throws Error with detail when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ detail: "Game not found" }),
    } as Response);
    await expect(api.getState()).rejects.toThrow("Game not found");
  });

  it("falls back to statusText when error body has no detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("parse error")),
    } as Response);
    await expect(api.getState()).rejects.toThrow("Internal Server Error");
  });
});

// ---------------------------------------------------------------------------
// BASE_URL configuration — guards against the property: host regression
// where Render injects a bare internal hostname (e.g. "yahtzee-api") that
// resolves only inside Render's network, not from user browsers.
// ---------------------------------------------------------------------------
describe("api BASE_URL configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ dice: [1, 2, 3, 4, 5] }),
    } as Response);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses EXPO_PUBLIC_API_URL when it is a full https URL (Render property: url)", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://yahtzee-api.onrender.com";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { api: freshApi } = require("../client") as typeof import("../client");
    await freshApi.newGame();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining("https://yahtzee-api.onrender.com"),
      expect.any(Object)
    );
  });

  it("builds a full onrender.com URL when EXPO_PUBLIC_API_URL is a bare slug (Render fromService)", async () => {
    // Render's fromService with property: url injects a bare subdomain slug,
    // e.g. "yahtzee-api-fql1" — no https:// and no .onrender.com suffix.
    process.env.EXPO_PUBLIC_API_URL = "yahtzee-api-fql1";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { api: freshApi } = require("../client") as typeof import("../client");
    await freshApi.newGame();
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^https:\/\/yahtzee-api-fql1\.onrender\.com/);
  });

  it("falls back to http://localhost:8000 when EXPO_PUBLIC_API_URL is not set", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { api: freshApi } = require("../client") as typeof import("../client");
    await freshApi.newGame();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:8000"),
      expect.any(Object)
    );
  });
});
