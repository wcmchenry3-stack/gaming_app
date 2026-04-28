import AsyncStorage from "@react-native-async-storage/async-storage";
import { getOrCreateSessionId } from "../session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("getOrCreateSessionId", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns a valid v4 UUID on first call", async () => {
    const sid = await getOrCreateSessionId();
    expect(sid).toMatch(UUID_RE);
  });

  it("returns the same ID on subsequent calls (persisted)", async () => {
    const first = await getOrCreateSessionId();
    const second = await getOrCreateSessionId();
    expect(second).toBe(first);
  });

  // -------------------------------------------------------------------------
  // generateUUID — crypto fallback (regression for Sentry issue: "Property
  // 'crypto' doesn't exist")
  // -------------------------------------------------------------------------

  describe("generateUUID crypto fallback", () => {
    let savedCrypto: typeof globalThis.crypto | undefined;

    beforeEach(async () => {
      savedCrypto = globalThis.crypto;
      await AsyncStorage.clear();
    });

    afterEach(() => {
      Object.defineProperty(globalThis, "crypto", {
        value: savedCrypto,
        configurable: true,
        writable: true,
      });
    });

    it("returns a valid v4 UUID when crypto is completely absent", async () => {
      Object.defineProperty(globalThis, "crypto", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const sid = await getOrCreateSessionId();
      expect(sid).toMatch(UUID_RE);
    });

    it("returns a valid v4 UUID when crypto exists but lacks randomUUID", async () => {
      Object.defineProperty(globalThis, "crypto", {
        value: {},
        configurable: true,
        writable: true,
      });
      const sid = await getOrCreateSessionId();
      expect(sid).toMatch(UUID_RE);
    });

    it("persists the fallback UUID and returns it on the next call", async () => {
      Object.defineProperty(globalThis, "crypto", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const first = await getOrCreateSessionId();
      // Restore crypto — second call should still return the stored fallback ID.
      Object.defineProperty(globalThis, "crypto", {
        value: savedCrypto,
        configurable: true,
        writable: true,
      });
      const second = await getOrCreateSessionId();
      expect(second).toBe(first);
    });
  });
});
