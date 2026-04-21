import { renderHook, act } from "@testing-library/react-native";
import { useGameSync } from "../useGameSync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStartGame = jest.fn<string, any[]>(() => "test-game-id");
const mockEnqueueEvent = jest.fn();
const mockCompleteGame = jest.fn();
const mockReportBug = jest.fn();

jest.mock("../gameEventClient", () => ({
  gameEventClient: {
    startGame: (...args: unknown[]) => mockStartGame(...args),
    enqueueEvent: (...args: unknown[]) => mockEnqueueEvent(...args),
    completeGame: (...args: unknown[]) => mockCompleteGame(...args),
    reportBug: (...args: unknown[]) => mockReportBug(...args),
  },
}));

describe("useGameSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartGame.mockReturnValue("test-game-id");
  });

  // ---------------------------------------------------------------------------
  // start
  // ---------------------------------------------------------------------------

  it("start() calls gameEventClient.startGame with the game type", () => {
    const { result } = renderHook(() => useGameSync("yacht"));
    act(() => {
      result.current.start({ initial_score: 0 });
    });
    expect(mockStartGame).toHaveBeenCalledWith("yacht", {}, { initial_score: 0 });
  });

  it("start() without eventData calls startGame with empty object", () => {
    const { result } = renderHook(() => useGameSync("twenty48"));
    act(() => {
      result.current.start();
    });
    expect(mockStartGame).toHaveBeenCalledWith("twenty48", {}, {});
  });

  it("start() with metadata passes it as the second arg to startGame", () => {
    const { result } = renderHook(() => useGameSync("sudoku"));
    act(() => {
      result.current.start({ difficulty: "hard" }, { difficulty: "hard" });
    });
    expect(mockStartGame).toHaveBeenCalledWith(
      "sudoku",
      { difficulty: "hard" },
      { difficulty: "hard" }
    );
  });

  // ---------------------------------------------------------------------------
  // enqueue
  // ---------------------------------------------------------------------------

  it("enqueue() after start() calls gameEventClient.enqueueEvent", () => {
    const { result } = renderHook(() => useGameSync("yacht"));
    act(() => {
      result.current.start();
      result.current.enqueue({ type: "roll", data: { dice: [1, 2, 3] } });
    });
    expect(mockEnqueueEvent).toHaveBeenCalledWith("test-game-id", {
      type: "roll",
      data: { dice: [1, 2, 3] },
    });
  });

  it("enqueue() before start() is a no-op", () => {
    const { result } = renderHook(() => useGameSync("yacht"));
    act(() => {
      result.current.enqueue({ type: "roll" });
    });
    expect(mockEnqueueEvent).not.toHaveBeenCalled();
  });

  it("enqueue() after complete() is a no-op", () => {
    const { result } = renderHook(() => useGameSync("yacht"));
    act(() => {
      result.current.start();
      result.current.complete({ finalScore: 100, outcome: "completed" });
      result.current.enqueue({ type: "roll" });
    });
    expect(mockEnqueueEvent).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // complete
  // ---------------------------------------------------------------------------

  it("complete() calls gameEventClient.completeGame with summary and payload", () => {
    const { result } = renderHook(() => useGameSync("yacht"));
    act(() => {
      result.current.start();
      result.current.complete({ finalScore: 250, outcome: "completed" }, { final_score: 250 });
    });
    expect(mockCompleteGame).toHaveBeenCalledWith(
      "test-game-id",
      { finalScore: 250, outcome: "completed" },
      { final_score: 250 }
    );
  });

  it("complete() without payload passes empty object", () => {
    const { result } = renderHook(() => useGameSync("yacht"));
    act(() => {
      result.current.start();
      result.current.complete({ outcome: "completed" });
    });
    expect(mockCompleteGame).toHaveBeenCalledWith("test-game-id", { outcome: "completed" }, {});
  });

  it("complete() is idempotent — only the first call fires", () => {
    const { result } = renderHook(() => useGameSync("yacht"));
    act(() => {
      result.current.start();
      result.current.complete({ outcome: "completed" });
      result.current.complete({ outcome: "completed" });
    });
    expect(mockCompleteGame).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // unmount cleanup
  // ---------------------------------------------------------------------------

  it("unmount without complete abandons the open session", () => {
    const { result, unmount } = renderHook(() => useGameSync("twenty48"));
    act(() => {
      result.current.start();
    });
    unmount();
    expect(mockCompleteGame).toHaveBeenCalledWith(
      "test-game-id",
      { outcome: "abandoned" },
      { outcome: "abandoned" }
    );
  });

  it("unmount after complete does not call completeGame again", () => {
    const { result, unmount } = renderHook(() => useGameSync("twenty48"));
    act(() => {
      result.current.start();
      result.current.complete({ finalScore: 512, outcome: "completed" });
    });
    unmount();
    // Only one call: the explicit complete(); unmount cleanup should be silent.
    expect(mockCompleteGame).toHaveBeenCalledTimes(1);
  });

  it("unmount without start does not call completeGame", () => {
    const { unmount } = renderHook(() => useGameSync("cascade"));
    unmount();
    expect(mockCompleteGame).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // restart
  // ---------------------------------------------------------------------------

  it("restart() abandons the current session and starts a new one", () => {
    mockStartGame.mockReturnValueOnce("session-1").mockReturnValueOnce("session-2");
    const { result } = renderHook(() => useGameSync("cascade"));
    act(() => {
      result.current.start({ fruit_set: "fruits" });
    });
    act(() => {
      result.current.restart({ fruit_set: "cosmos" });
    });
    // First session abandoned
    expect(mockCompleteGame).toHaveBeenCalledWith(
      "session-1",
      { outcome: "abandoned" },
      { outcome: "abandoned" }
    );
    // Second session started
    expect(mockStartGame).toHaveBeenCalledTimes(2);
    expect(mockStartGame).toHaveBeenLastCalledWith("cascade", {}, { fruit_set: "cosmos" });
  });

  it("restart() after complete() does not double-abandon", () => {
    mockStartGame.mockReturnValueOnce("session-1").mockReturnValueOnce("session-2");
    const { result } = renderHook(() => useGameSync("cascade"));
    act(() => {
      result.current.start();
      result.current.complete({ outcome: "completed" });
      result.current.restart();
    });
    // completeGame called once for the explicit complete, not again for restart
    expect(mockCompleteGame).toHaveBeenCalledTimes(1);
    expect(mockCompleteGame).toHaveBeenCalledWith("session-1", { outcome: "completed" }, {});
    // New session started
    expect(mockStartGame).toHaveBeenCalledTimes(2);
  });

  it("enqueue() after restart() sends to the new session id", () => {
    mockStartGame.mockReturnValueOnce("old-id").mockReturnValueOnce("new-id");
    const { result } = renderHook(() => useGameSync("cascade"));
    act(() => {
      result.current.start();
      result.current.restart();
      result.current.enqueue({ type: "drop", data: { tier: 2 } });
    });
    expect(mockEnqueueEvent).toHaveBeenCalledWith("new-id", { type: "drop", data: { tier: 2 } });
  });

  // ---------------------------------------------------------------------------
  // reportBug
  // ---------------------------------------------------------------------------

  it("reportBug() delegates to gameEventClient.reportBug", () => {
    const { result } = renderHook(() => useGameSync("yacht"));
    act(() => {
      result.current.reportBug("warn", "yacht.engine", "unexpected state", { round: 3 });
    });
    expect(mockReportBug).toHaveBeenCalledWith("warn", "yacht.engine", "unexpected state", {
      round: 3,
    });
  });
});
