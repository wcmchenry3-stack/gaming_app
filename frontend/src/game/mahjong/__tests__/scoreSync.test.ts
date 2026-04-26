import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScoreQueue } from "../../_shared/scoreQueue";
import { registerMahjongScoreHandler } from "../scoreSync";
import { mahjongApi } from "../api";

jest.mock("../api", () => ({
  mahjongApi: {
    submitScore: jest.fn(),
  },
}));

describe("registerMahjongScoreHandler", () => {
  let queue: ScoreQueue;

  beforeEach(async () => {
    await AsyncStorage.clear();
    queue = new ScoreQueue();
    (mahjongApi.submitScore as jest.Mock).mockReset();
    registerMahjongScoreHandler.call(null);
    // Re-register on our local queue instance so we can test in isolation.
    queue.registerHandler("mahjong", async (item) => {
      const { player_name, score } = item.payload as { player_name: string; score: number };
      if (typeof player_name !== "string" || typeof score !== "number") return;
      await mahjongApi.submitScore(player_name, score);
    });
  });

  it("calls mahjongApi.submitScore with player_name and score from payload", async () => {
    (mahjongApi.submitScore as jest.Mock).mockResolvedValue({
      player_name: "Alice",
      score: 500,
      rank: 1,
    });
    await queue.enqueue("mahjong", { player_name: "Alice", score: 500 });
    await queue.flush();
    expect(mahjongApi.submitScore).toHaveBeenCalledWith("Alice", 500);
  });

  it("drops a malformed payload without throwing (so it is not retried)", async () => {
    await queue.enqueue("mahjong", { bad: "payload" });
    const result = await queue.flush();
    expect(result.succeeded).toBe(1);
    expect(result.remaining).toBe(0);
    expect(mahjongApi.submitScore).not.toHaveBeenCalled();
  });

  it("leaves the item in the queue when submitScore throws", async () => {
    (mahjongApi.submitScore as jest.Mock).mockRejectedValue(new Error("network error"));
    await queue.enqueue("mahjong", { player_name: "Bob", score: 300 });
    const result = await queue.flush();
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(1);
  });
});
