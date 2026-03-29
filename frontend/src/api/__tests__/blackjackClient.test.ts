import { blackjackApi } from "../blackjackClient";

describe("blackjackApi endpoints", () => {
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

  it("throws Error with detail when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ detail: "No active game" }),
    } as Response);
    await expect(blackjackApi.getState()).rejects.toThrow("No active game");
  });

  it("falls back to statusText when error body has no detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("parse error")),
    } as Response);
    await expect(blackjackApi.getState()).rejects.toThrow("Internal Server Error");
  });
});

// ---------------------------------------------------------------------------
// BASE_URL configuration
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-require-imports */
describe("blackjackApi BASE_URL configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ phase: "betting" }),
    } as Response);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses EXPO_PUBLIC_API_URL when it is a full https URL", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://yahtzee-api.onrender.com";
    const { blackjackApi: api } =
      require("../blackjackClient") as typeof import("../blackjackClient");
    await api.newSession();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining("https://yahtzee-api.onrender.com"),
      expect.any(Object)
    );
  });

  it("builds a full onrender.com URL when EXPO_PUBLIC_API_URL is a bare slug", async () => {
    process.env.EXPO_PUBLIC_API_URL = "yahtzee-api-fql1";
    const { blackjackApi: api } =
      require("../blackjackClient") as typeof import("../blackjackClient");
    await api.newSession();
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^https:\/\/yahtzee-api-fql1\.onrender\.com/);
  });

  it("falls back to https://yahtzee-api-fql1.onrender.com when EXPO_PUBLIC_API_URL is not set", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const { blackjackApi: api } =
      require("../blackjackClient") as typeof import("../blackjackClient");
    await api.newSession();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining("https://yahtzee-api-fql1.onrender.com"),
      expect.any(Object)
    );
  });
});
/* eslint-enable @typescript-eslint/no-require-imports */
