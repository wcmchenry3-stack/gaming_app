import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScoreQueue } from "../scoreQueue";
import { PendingSubmission } from "../types";

describe("ScoreQueue", () => {
  let queue: ScoreQueue;

  beforeEach(async () => {
    await AsyncStorage.clear();
    queue = new ScoreQueue();
  });

  it("enqueues an item with UUID, played_at, and zero attempts", async () => {
    const item = await queue.enqueue("cascade", { player_name: "Alice", score: 500 });
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.game_type).toBe("cascade");
    expect(item.payload).toEqual({ player_name: "Alice", score: 500 });
    expect(item.attempts).toBe(0);
    expect(item.played_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("persists items across ScoreQueue instances", async () => {
    await queue.enqueue("cascade", { player_name: "A", score: 1 });
    await queue.enqueue("cascade", { player_name: "B", score: 2 });
    const fresh = new ScoreQueue();
    const items = await fresh.peek();
    expect(items).toHaveLength(2);
    expect(items[0]?.payload.player_name).toBe("A");
    expect(items[1]?.payload.player_name).toBe("B");
  });

  it("flush removes items whose handler resolves successfully", async () => {
    await queue.enqueue("cascade", { player_name: "A", score: 1 });
    await queue.enqueue("cascade", { player_name: "B", score: 2 });
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.registerHandler("cascade", handler);
    const result = await queue.flush();
    expect(result).toEqual({ attempted: 2, succeeded: 2, failed: 0, remaining: 0 });
    expect(handler).toHaveBeenCalledTimes(2);
    expect(await queue.size()).toBe(0);
  });

  it("flush keeps items whose handler throws, increments attempts", async () => {
    await queue.enqueue("cascade", { player_name: "A", score: 1 });
    queue.registerHandler("cascade", jest.fn().mockRejectedValue(new Error("500")));
    const result = await queue.flush();
    expect(result).toEqual({ attempted: 1, succeeded: 0, failed: 1, remaining: 1 });
    const peeked = await queue.peek();
    const item = peeked[0];
    if (item === undefined) throw new Error("Expected item");
    expect(item.attempts).toBe(1);
    expect(item.last_error).toBe("500");
  });

  it("flush retries only the failed items on subsequent calls", async () => {
    await queue.enqueue("cascade", { player_name: "A", score: 1 });
    await queue.enqueue("cascade", { player_name: "B", score: 2 });
    const handler = jest
      .fn<Promise<void>, [PendingSubmission]>()
      .mockRejectedValueOnce(new Error("fail A"))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    queue.registerHandler("cascade", handler);

    const first = await queue.flush();
    expect(first).toEqual({ attempted: 2, succeeded: 1, failed: 1, remaining: 1 });

    const second = await queue.flush();
    expect(second).toEqual({ attempted: 1, succeeded: 1, failed: 0, remaining: 0 });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("flush keeps items whose game_type has no registered handler", async () => {
    await queue.enqueue("yacht", { total_score: 284 });
    const result = await queue.flush();
    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0, remaining: 1 });
    expect(await queue.size()).toBe(1);
  });

  it("dead-letters an item after MAX_SCORE_ATTEMPTS failures and emits Sentry warning", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/react-native");
    Sentry.captureMessage.mockClear();

    await queue.enqueue("cascade", { player_name: "A", score: 1 });
    const handler = jest.fn().mockRejectedValue(new Error("network failure"));
    queue.registerHandler("cascade", handler);

    // Flush MAX_SCORE_ATTEMPTS (5) times — item should be dropped on the 5th.
    for (let i = 0; i < 4; i++) {
      const r = await queue.flush();
      expect(r.remaining).toBe(1);
    }
    const final = await queue.flush();
    expect(final.remaining).toBe(0);
    expect(await queue.size()).toBe(0);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("dead-lettering cascade score"),
      expect.objectContaining({ level: "warning" })
    );
  });

  it("flush returns zero-result when queue is empty", async () => {
    const result = await queue.flush();
    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0, remaining: 0 });
  });

  it("concurrent flush calls do not double-submit", async () => {
    await queue.enqueue("cascade", { player_name: "A", score: 1 });
    let resolveHandler: () => void = () => undefined;
    const handler = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHandler = resolve;
        })
    );
    queue.registerHandler("cascade", handler);

    const first = queue.flush();
    const second = queue.flush();
    // second returns immediately because flushInProgress is true
    const secondResult = await second;
    expect(secondResult.attempted).toBe(0);
    expect(handler).toHaveBeenCalledTimes(1);

    resolveHandler();
    await first;
    expect(await queue.size()).toBe(0);
  });
});
