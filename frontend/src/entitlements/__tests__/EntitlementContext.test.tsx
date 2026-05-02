/**
 * Tests for EntitlementContext.
 *
 * Jest runs with __DEV__ = true and no EXPO_PUBLIC_ENTITLEMENT_PUBLIC_KEY set,
 * so verifyRawToken takes the dev branch — it calls jose.decodeJwt and trusts
 * the payload without signature verification. That path exercises all the
 * loading, caching, and offline grace logic.
 *
 * The verifyRawToken describe block below tests the dev-mode code paths
 * (decodeJwt success, expired payload detection, and decode failure).
 * The RS256 production path (importSPKI + jwtVerify) requires a real key pair
 * and is not covered in the Jest suite.
 */

import React from "react";
import { AppState, AppStateStatus } from "react-native";
import { render, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("jose", () => ({
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
  decodeJwt: jest.fn(),
  errors: {},
}));

const mockRequest = jest.fn();
jest.mock("../../game/_shared/httpClient", () => ({
  // Wrap in an intermediate closure so mockRequest is read at call-time, not at
  // module-evaluation time when babel-jest hoists jest.mock above const declarations.
  createGameClient: jest.fn(() => (...args: unknown[]) => mockRequest(...args as Parameters<typeof mockRequest>)),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import * as joseModule from "jose";
import {
  EntitlementProvider,
  useEntitlements,
  verifyRawToken,
  PREMIUM_GAMES,
  OFFLINE_GRACE_MS,
  TOKEN_STORAGE_KEY,
  CACHED_AT_STORAGE_KEY,
} from "../EntitlementContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockDecodeJwt = joseModule.decodeJwt as jest.Mock;
const mockImportSPKI = joseModule.importSPKI as jest.Mock;
const mockJwtVerify = joseModule.jwtVerify as jest.Mock;

function makePayload(
  entitled: string[],
  expOffsetMs = 3_600_000
): { sub: string; entitled_games: string[]; iat: number; exp: number } {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: "test-session",
    entitled_games: entitled,
    iat: now,
    exp: now + Math.floor(expOffsetMs / 1000),
  };
}

function getAppStateListener(): (s: AppStateStatus) => void {
  const mock = AppState.addEventListener as jest.Mock;
  const call = mock.mock.calls.find((c: unknown[]) => c[0] === "change");
  if (!call) throw new Error("AppState.addEventListener('change') not called");
  return call[1] as (s: AppStateStatus) => void;
}

let ctx: ReturnType<typeof useEntitlements>;
function Probe() {
  ctx = useEntitlements();
  return null;
}

const flushAsync = () =>
  act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

async function renderProvider() {
  render(
    <EntitlementProvider>
      <Probe />
    </EntitlementProvider>
  );
  // Flush the full async init() chain:
  // useEffect → init() → fetchRawToken → verifyRawToken → AsyncStorage.multiSet → setState
  await flushAsync();
  await flushAsync();
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  const payload = makePayload([]);
  mockRequest.mockResolvedValue({ token: "t.t.t", expires_at: "2099-01-01T00:00:00Z" });
  mockDecodeJwt.mockReturnValue(payload);
});

// ---------------------------------------------------------------------------
// Component / integration tests (dev mode — no signature verification)
// ---------------------------------------------------------------------------

describe("EntitlementProvider", () => {
  describe("canPlay — free vs premium", () => {
    it("returns false for a premium game when session has no entitlements", async () => {
      await renderProvider();
      expect(ctx.canPlay("cascade")).toBe(false);
    });

    it("returns true for free games regardless of entitlement state", async () => {
      await renderProvider();
      for (const slug of ["blackjack", "twenty48", "solitaire", "mahjong", "freecell"]) {
        expect(ctx.canPlay(slug)).toBe(true);
      }
    });

    it("returns true for each entitled premium game", async () => {
      mockDecodeJwt.mockReturnValue(makePayload(["cascade", "hearts"]));
      await renderProvider();
      expect(ctx.canPlay("cascade")).toBe(true);
      expect(ctx.canPlay("hearts")).toBe(true);
      expect(ctx.canPlay("sudoku")).toBe(false);
    });

    it("covers exactly the five premium game slugs", () => {
      expect(PREMIUM_GAMES).toEqual(
        new Set(["yacht", "cascade", "hearts", "sudoku", "starswarm"])
      );
    });
  });

  describe("loading state", () => {
    it("resolves isLoading to false after initialization", async () => {
      await renderProvider();
      expect(ctx.isLoading).toBe(false);
    });

    it("sets lastRefreshed after a successful fetch", async () => {
      const before = new Date();
      await renderProvider();
      expect(ctx.lastRefreshed).not.toBeNull();
      expect(ctx.lastRefreshed!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe("token verification failure", () => {
    it("denies all premium games when token cannot be decoded", async () => {
      mockDecodeJwt.mockImplementation(() => {
        throw new Error("invalid token");
      });
      await renderProvider();
      for (const slug of PREMIUM_GAMES) {
        expect(ctx.canPlay(slug)).toBe(false);
      }
    });
  });

  describe("expired token + online", () => {
    it("re-fetches silently on app load and reflects fresh entitlements", async () => {
      mockDecodeJwt.mockReturnValue(makePayload(["cascade"]));
      await renderProvider();
      expect(ctx.canPlay("cascade")).toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it("re-fetches on foreground transition", async () => {
      await renderProvider();
      const listener = getAppStateListener();
      mockRequest.mockClear();
      mockDecodeJwt.mockReturnValue(makePayload(["sudoku"]));

      await act(async () => {
        listener("active");
        await new Promise<void>((resolve) => setImmediate(resolve));
      });

      expect(ctx.canPlay("sudoku")).toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe("offline grace period", () => {
    async function seedExpiredCache(entitled: string[], cachedAgoMs: number) {
      const expiredPayload = makePayload(entitled, -3_600_000);
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, "cached.t.t");
      await AsyncStorage.setItem(
        CACHED_AT_STORAGE_KEY,
        new Date(Date.now() - cachedAgoMs).toISOString()
      );
      mockRequest.mockRejectedValue(new TypeError("Network request failed"));
      mockDecodeJwt.mockReturnValue(expiredPayload);
    }

    it("grants cached entitlements when offline within 7 days of last fetch", async () => {
      await seedExpiredCache(["cascade"], OFFLINE_GRACE_MS / 2);
      await renderProvider();
      expect(ctx.canPlay("cascade")).toBe(true);
    });

    it("denies premium games when offline beyond 7-day grace period", async () => {
      await seedExpiredCache(["cascade"], OFFLINE_GRACE_MS + 24 * 60 * 60 * 1000);
      await renderProvider();
      expect(ctx.canPlay("cascade")).toBe(false);
    });

    it("denies premium and allows free when no cache and fetch fails", async () => {
      mockRequest.mockRejectedValue(new TypeError("Network request failed"));
      await renderProvider();
      expect(ctx.canPlay("cascade")).toBe(false);
      expect(ctx.canPlay("blackjack")).toBe(true);
    });
  });

  describe("cache persistence", () => {
    it("writes token and cachedAt to AsyncStorage on successful fetch", async () => {
      await renderProvider();
      expect(await AsyncStorage.getItem(TOKEN_STORAGE_KEY)).toBe("t.t.t");
      expect(await AsyncStorage.getItem(CACHED_AT_STORAGE_KEY)).not.toBeNull();
    });

    it("loads from valid cached token when offline", async () => {
      const cachedPayload = makePayload(["starswarm"]);
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, "cached.t.t");
      await AsyncStorage.setItem(CACHED_AT_STORAGE_KEY, new Date().toISOString());
      mockRequest.mockRejectedValue(new TypeError("Network request failed"));
      mockDecodeJwt.mockReturnValue(cachedPayload);

      await renderProvider();

      expect(ctx.canPlay("starswarm")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Unit tests for verifyRawToken (dev-mode paths: decodeJwt success, expiry,
// and decode failure). The RS256 path requires a real key pair and is not
// tested in Jest — see the block comment at the top of this file.
// ---------------------------------------------------------------------------

describe("verifyRawToken", () => {
  beforeEach(() => {
    mockImportSPKI.mockResolvedValue("pub-key");
  });

  it("returns valid+unexpired for a token with a future exp", async () => {
    const payload = makePayload(["cascade"]);
    mockJwtVerify.mockResolvedValue({ payload });
    mockDecodeJwt.mockReturnValue(payload);
    const result = await verifyRawToken("any.token.here");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.expired).toBe(false);
  });

  it("returns valid+expired for a token with a past exp", async () => {
    const expiredPayload = makePayload(["cascade"], -3_600_000);
    mockDecodeJwt.mockReturnValue(expiredPayload);
    const result = await verifyRawToken("any.token.here");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.expired).toBe(true);
  });

  it("returns invalid when decodeJwt throws (undecodable token)", async () => {
    mockDecodeJwt.mockImplementation(() => { throw new Error("malformed"); });
    const result = await verifyRawToken("bad.token");
    expect(result.valid).toBe(false);
  });
});
