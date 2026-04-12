import { SessionLogger } from "../SessionLogger";

beforeEach(() => {
  SessionLogger._reset();
});

afterEach(() => {
  SessionLogger._reset();
});

describe("SessionLogger", () => {
  describe("init()", () => {
    it("patches console.warn and captures entries", () => {
      SessionLogger.init();
      console.warn("hello warn");
      expect(SessionLogger.size).toBe(1);
      const logs = SessionLogger.getLogs();
      expect(logs).toMatch(/WARN hello warn/);
    });

    it("patches console.error and captures entries", () => {
      SessionLogger.init();
      console.error("boom");
      expect(SessionLogger.size).toBe(1);
      expect(SessionLogger.getLogs()).toMatch(/ERROR boom/);
    });

    it("is idempotent — calling init() twice does not double-patch", () => {
      SessionLogger.init();
      SessionLogger.init();
      console.warn("once");
      expect(SessionLogger.size).toBe(1);
    });

    it('serialises Error objects as "Name: message"', () => {
      SessionLogger.init();
      console.error(new Error("something broke"));
      expect(SessionLogger.getLogs()).toMatch(/Error: something broke/);
    });

    it("serialises non-string non-Error args via JSON.stringify", () => {
      SessionLogger.init();
      console.warn({ code: 42 });
      expect(SessionLogger.getLogs()).toMatch(/\{"code":42\}/);
    });

    it("joins multiple args with a space", () => {
      SessionLogger.init();
      console.warn("a", "b", "c");
      expect(SessionLogger.getLogs()).toMatch(/WARN a b c/);
    });
  });

  describe("circular buffer", () => {
    it("wraps at MAX_ENTRIES (200) — oldest entry is dropped", () => {
      SessionLogger.init();
      for (let i = 0; i < 201; i++) {
        console.warn(`msg-${i}`);
      }
      expect(SessionLogger.size).toBe(200);
      // msg-0 has been evicted; msg-1 is now the oldest
      expect(SessionLogger.getLogs()).not.toMatch(/WARN msg-0\b/);
      expect(SessionLogger.getLogs()).toMatch(/WARN msg-1\b/);
      expect(SessionLogger.getLogs()).toMatch(/WARN msg-200\b/);
    });
  });

  describe("getLogs()", () => {
    it("returns empty string when buffer is empty", () => {
      expect(SessionLogger.getLogs()).toBe("");
    });

    it("includes ISO timestamps", () => {
      SessionLogger.init();
      console.warn("ts-test");
      expect(SessionLogger.getLogs()).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("lists entries oldest-first (bottom is most recent)", () => {
      SessionLogger.init();
      console.warn("first");
      console.warn("second");
      const lines = SessionLogger.getLogs().split("\n");
      expect(lines[0]).toMatch(/first/);
      expect(lines[1]).toMatch(/second/);
    });
  });

  describe("_reset()", () => {
    it("clears the buffer", () => {
      SessionLogger.init();
      console.warn("x");
      SessionLogger._reset();
      expect(SessionLogger.size).toBe(0);
      expect(SessionLogger.getLogs()).toBe("");
    });

    it("allows re-initialisation after reset", () => {
      SessionLogger.init();
      SessionLogger._reset();
      SessionLogger.init();
      console.warn("after reset");
      expect(SessionLogger.size).toBe(1);
    });
  });
});
