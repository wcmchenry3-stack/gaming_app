import { fruitMergeApi } from "../fruitMergeClient";

describe("fruitMergeApi endpoints", () => {
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

  it("submitScore POSTs player_name and score to /fruit-merge/score", async () => {
    respondWith({ player_name: "Alice", score: 500 });
    await fruitMergeApi.submitScore("Alice", 500);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/fruit-merge/score"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ player_name: "Alice", score: 500 }),
      })
    );
  });

  it("getLeaderboard GETs /fruit-merge/scores", async () => {
    respondWith({ scores: [] });
    await fruitMergeApi.getLeaderboard();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/fruit-merge/scores"),
      expect.any(Object)
    );
  });

  it("throws Error with detail when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ detail: "Invalid score" }),
    } as Response);
    await expect(fruitMergeApi.submitScore("Bob", -1)).rejects.toThrow("Invalid score");
  });

  it("falls back to statusText when error body has no detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("parse error")),
    } as Response);
    await expect(fruitMergeApi.getLeaderboard()).rejects.toThrow("Internal Server Error");
  });
});

// ---------------------------------------------------------------------------
// BASE_URL configuration
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-require-imports */
describe("fruitMergeApi BASE_URL configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ scores: [] }),
    } as Response);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses EXPO_PUBLIC_API_URL when it is a full https URL", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://yahtzee-api.onrender.com";
    const { fruitMergeApi: api } =
      require("../fruitMergeClient") as typeof import("../fruitMergeClient");
    await api.getLeaderboard();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining("https://yahtzee-api.onrender.com"),
      expect.any(Object)
    );
  });

  it("builds a full onrender.com URL when EXPO_PUBLIC_API_URL is a bare slug", async () => {
    process.env.EXPO_PUBLIC_API_URL = "yahtzee-api-fql1";
    const { fruitMergeApi: api } =
      require("../fruitMergeClient") as typeof import("../fruitMergeClient");
    await api.getLeaderboard();
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^https:\/\/yahtzee-api-fql1\.onrender\.com/);
  });

  it("falls back to http://localhost:8000 when EXPO_PUBLIC_API_URL is not set", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const { fruitMergeApi: api } =
      require("../fruitMergeClient") as typeof import("../fruitMergeClient");
    await api.getLeaderboard();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:8000"),
      expect.any(Object)
    );
  });
});
/* eslint-enable @typescript-eslint/no-require-imports */
