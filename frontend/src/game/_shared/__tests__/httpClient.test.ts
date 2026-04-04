/**
 * Tests for the shared HTTP client factory.
 *
 * Covers cross-cutting behavior that every game's API client inherits:
 * - BASE_URL derivation from EXPO_PUBLIC_API_URL (with protocol fallback)
 * - Error shaping (detail from body, statusText fallback)
 *
 * Per-game endpoint assertions (correct path / method / body for each
 * call) live in the respective game's api.test.ts.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

describe("httpClient — BASE_URL configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadClient() {
    const { createGameClient } = require("../httpClient") as typeof import("../httpClient");
    return createGameClient({ apiTag: "test" });
  }

  it("uses EXPO_PUBLIC_API_URL when it is a full https URL", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://dev-games-api.buffingchi.com";
    const request = loadClient();
    await request("/any/path");
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      "https://dev-games-api.buffingchi.com/any/path",
      expect.any(Object)
    );
  });

  it("prepends https:// when EXPO_PUBLIC_API_URL has no protocol", async () => {
    process.env.EXPO_PUBLIC_API_URL = "dev-games-api.buffingchi.com";
    const request = loadClient();
    await request("/any/path");
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      "https://dev-games-api.buffingchi.com/any/path",
      expect.any(Object)
    );
  });

  it("falls back to http://localhost:8000 when EXPO_PUBLIC_API_URL is not set", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const request = loadClient();
    await request("/any/path");
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      "http://localhost:8000/any/path",
      expect.any(Object)
    );
  });
});

describe("httpClient — error handling", () => {
  let request: (path: string, options?: RequestInit) => Promise<unknown>;
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    global.fetch = mockFetch;
    mockFetch.mockReset();
    const { createGameClient } = require("../httpClient") as typeof import("../httpClient");
    request = createGameClient({ apiTag: "test" });
  });

  it("throws Error with detail when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ detail: "Invalid input" }),
    } as Response);
    await expect(request("/x")).rejects.toThrow("Invalid input");
  });

  it("falls back to statusText when error body has no detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("parse error")),
    } as Response);
    await expect(request("/x")).rejects.toThrow("Internal Server Error");
  });

  it("sends Content-Type and X-Session-ID headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
    await request("/x");
    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Session-ID"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
