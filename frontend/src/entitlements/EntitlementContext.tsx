import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import * as jose from "jose";
import { createGameClient } from "../game/_shared/httpClient";
import { ENTITLEMENT_PUBLIC_KEY } from "../config/entitlementPublicKey";

// Premium games — sourced from backend migration 0014_game_types_premium_cat
export const PREMIUM_GAMES = new Set(["yacht", "cascade", "hearts", "sudoku", "starswarm"]);

export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export const TOKEN_STORAGE_KEY = "entitlement_token";
export const CACHED_AT_STORAGE_KEY = "entitlement_cached_at";

interface EntitlementJWTPayload extends jose.JWTPayload {
  sub: string;
  entitled_games: string[];
  iat: number;
  exp: number;
}

export type VerifyResult =
  | { valid: true; payload: EntitlementJWTPayload; expired: boolean }
  | { valid: false };

export interface EntitlementContextValue {
  /** Returns false for premium games while isLoading is true. Gate on isLoading before trusting the result. */
  canPlay: (gameSlug: string) => boolean;
  isLoading: boolean;
  lastRefreshed: Date | null;
}

const EntitlementContext = createContext<EntitlementContextValue>({
  canPlay: (slug) => !PREMIUM_GAMES.has(slug),
  isLoading: true,
  lastRefreshed: null,
});

const _entitlementsClient = createGameClient({ apiTag: "entitlements" });

export async function fetchRawToken(): Promise<string> {
  const res = await _entitlementsClient<{ token: string; expires_at: string }>("/entitlements");
  return res.token;
}

export async function verifyRawToken(rawToken: string): Promise<VerifyResult> {
  try {
    if (!ENTITLEMENT_PUBLIC_KEY) {
      if (__DEV__) {
        const payload = jose.decodeJwt(rawToken) as EntitlementJWTPayload;
        const expired = Date.now() / 1000 > payload.exp;
        return { valid: true, payload, expired };
      }
      Sentry.captureMessage(
        "EXPO_PUBLIC_ENTITLEMENT_PUBLIC_KEY not set in production build",
        { level: "error", tags: { subsystem: "entitlements" } }
      );
      return { valid: false };
    }

    const publicKey = await jose.importSPKI(ENTITLEMENT_PUBLIC_KEY, "RS256");

    try {
      const { payload } = await jose.jwtVerify(rawToken, publicKey, {
        algorithms: ["RS256"],
      });
      return { valid: true, payload: payload as EntitlementJWTPayload, expired: false };
    } catch (e) {
      if ((e as { code?: string })?.code === "ERR_JWT_EXPIRED") {
        const payload = jose.decodeJwt(rawToken) as EntitlementJWTPayload;
        return { valid: true, payload, expired: true };
      }
      return { valid: false };
    }
  } catch {
    return { valid: false };
  }
}

export async function loadCachedEntitlements(): Promise<Set<string>> {
  try {
    const pairs = await AsyncStorage.multiGet([TOKEN_STORAGE_KEY, CACHED_AT_STORAGE_KEY]);
    const token = pairs[0]?.[1] ?? null;
    const cachedAt = pairs[1]?.[1] ?? null;

    if (!token || !cachedAt) return new Set();

    const result = await verifyRawToken(token);
    if (!result.valid) return new Set();

    if (!result.expired) return new Set(result.payload.entitled_games);

    // Expired token: grant access during offline grace period
    const ageMs = Date.now() - new Date(cachedAt).getTime();
    if (ageMs < OFFLINE_GRACE_MS) {
      console.warn("[entitlements] Expired token within 7-day grace period — granting cached access");
      return new Set(result.payload.entitled_games);
    }

    console.warn("[entitlements] Offline grace period expired — denying premium access");
    return new Set();
  } catch {
    return new Set();
  }
}

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [entitledGames, setEntitledGames] = useState<Set<string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rawToken = await fetchRawToken();
      const result = await verifyRawToken(rawToken);
      if (result.valid && !result.expired) {
        await AsyncStorage.multiSet([
          [TOKEN_STORAGE_KEY, rawToken],
          [CACHED_AT_STORAGE_KEY, new Date().toISOString()],
        ]);
        setEntitledGames(new Set(result.payload.entitled_games));
        setLastRefreshed(new Date());
      } else {
        // Server returned expired or unverifiable token (clock skew, TTL edge case).
        // Fall back to cache so in-memory state stays consistent with storage.
        setEntitledGames(await loadCachedEntitlements());
      }
    } catch (e) {
      if (!(e instanceof TypeError)) {
        Sentry.addBreadcrumb({
          category: "entitlements",
          message: "token refresh failed",
          level: "warning",
          data: { error: String(e) },
        });
      }
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        // Fetch fresh token first; fall back to cache on offline or error.
        const rawToken = await fetchRawToken();
        const result = await verifyRawToken(rawToken);
        if (result.valid && !result.expired) {
          await AsyncStorage.multiSet([
            [TOKEN_STORAGE_KEY, rawToken],
            [CACHED_AT_STORAGE_KEY, new Date().toISOString()],
          ]);
          setEntitledGames(new Set(result.payload.entitled_games));
          setLastRefreshed(new Date());
        } else {
          setEntitledGames(await loadCachedEntitlements());
        }
      } catch {
        setEntitledGames(await loadCachedEntitlements());
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Re-fetch on every foreground transition.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const canPlay = useCallback(
    (gameSlug: string): boolean => {
      if (!PREMIUM_GAMES.has(gameSlug)) return true;
      if (entitledGames === null) return false;
      return entitledGames.has(gameSlug);
    },
    [entitledGames]
  );

  return (
    <EntitlementContext.Provider value={{ canPlay, isLoading, lastRefreshed }}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlements(): EntitlementContextValue {
  return useContext(EntitlementContext);
}
