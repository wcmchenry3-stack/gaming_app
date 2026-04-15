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

  it("falls back to http://localhost:8000 when EXPO_PUBLIC_API_URL is not set in dev", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    // jest-expo sets __DEV__ = true by default; assert that explicitly
    // so this test fails loudly if the preset ever changes.
    expect((globalThis as { __DEV__?: boolean }).__DEV__).toBe(true);
    const request = loadClient();
    await request("/any/path");
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      "http://localhost:8000/any/path",
      expect.any(Object)
    );
  });

  it("throws at module load when EXPO_PUBLIC_API_URL is not set in a non-dev build (#511)", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const g = globalThis as { __DEV__?: boolean };
    const originalDev = g.__DEV__;
    g.__DEV__ = false;
    try {
      // Module-level throw happens inside createGameClient because BASE_URL
      // is resolved eagerly. Verify both the throw and the Sentry breadcrumb.
      expect(() => loadClient()).toThrow(/EXPO_PUBLIC_API_URL is not set/);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/react-native");
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining("EXPO_PUBLIC_API_URL is not set"),
        expect.objectContaining({ level: "fatal" })
      );
    } finally {
      g.__DEV__ = originalDev;
    }
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

  it("throws ApiError with status code on non-ok response", async () => {
    const { ApiError } = require("../httpClient") as typeof import("../httpClient");
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ detail: "No game in progress" }),
    } as Response);
    try {
      await request("/x");
      fail("expected request to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
      expect((e as Error).message).toBe("No game in progress");
    }
  });

  it("throws ApiError with status 500 for server errors", async () => {
    const { ApiError } = require("../httpClient") as typeof import("../httpClient");
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ detail: "Something broke" }),
    } as Response);
    try {
      await request("/x");
      fail("expected request to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
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
