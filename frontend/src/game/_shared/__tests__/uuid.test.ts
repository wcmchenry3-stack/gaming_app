import { generateUUID } from "../uuid";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateUUID", () => {
  describe("tier 1: crypto.randomUUID", () => {
    it("returns a UUID-shaped string via the native implementation", () => {
      expect(generateUUID()).toMatch(UUID_V4_RE);
    });
  });

  describe("tier 2: crypto.getRandomValues", () => {
    const origCrypto = (global as Record<string, unknown>).crypto;

    afterEach(() => {
      Object.defineProperty(global, "crypto", { value: origCrypto, configurable: true });
    });

    it("falls through to getRandomValues when randomUUID is absent", () => {
      Object.defineProperty(global, "crypto", {
        value: {
          getRandomValues(b: Uint8Array) {
            b.fill(0xab);
            return b;
          },
        },
        configurable: true,
      });
      expect(generateUUID()).toMatch(UUID_V4_RE);
    });
  });

  describe("tier 3: timestamp+counter fallback (no Crypto API)", () => {
    const origCrypto = (global as Record<string, unknown>).crypto;
    const origPerf = (global as Record<string, unknown>).performance;

    beforeEach(() => {
      Object.defineProperty(global, "crypto", { value: undefined, configurable: true });
    });

    afterEach(() => {
      Object.defineProperty(global, "crypto", { value: origCrypto, configurable: true });
      Object.defineProperty(global, "performance", { value: origPerf, configurable: true });
    });

    it("returns a UUID-v4-shaped string", () => {
      expect(generateUUID()).toMatch(UUID_V4_RE);
    });

    it("produces different IDs on consecutive calls (monotonic counter)", () => {
      const a = generateUUID();
      const b = generateUUID();
      expect(a).not.toBe(b);
    });

    it("returns a UUID-shaped string even when performance.now is absent", () => {
      Object.defineProperty(global, "performance", { value: undefined, configurable: true });
      expect(generateUUID()).toMatch(UUID_V4_RE);
    });
  });
});
