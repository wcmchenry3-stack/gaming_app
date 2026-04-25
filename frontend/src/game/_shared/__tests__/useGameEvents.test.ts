import { renderHook } from "@testing-library/react-native";
import { useGameEvents } from "../useGameEvents";
import type { GameEvent } from "../../hearts/types";

describe("useGameEvents", () => {
  it("fires the correct callback for each event type in the array", () => {
    const onMoonShot = jest.fn();
    const onHeartsBroken = jest.fn();
    const onQueenOfSpades = jest.fn();
    const onClear = jest.fn();

    const events: GameEvent[] = [
      { type: "moonShot", shooter: 0 },
      { type: "heartsBroken" },
      { type: "queenOfSpades", takerSeat: 2 },
    ];

    renderHook(() =>
      useGameEvents(
        events,
        { moonShot: onMoonShot, heartsBroken: onHeartsBroken, queenOfSpades: onQueenOfSpades },
        onClear
      )
    );

    expect(onMoonShot).toHaveBeenCalledWith({ type: "moonShot", shooter: 0 });
    expect(onHeartsBroken).toHaveBeenCalledWith({ type: "heartsBroken" });
    expect(onQueenOfSpades).toHaveBeenCalledWith({ type: "queenOfSpades", takerSeat: 2 });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("does not re-fire events that have already been processed", () => {
    const onMoonShot = jest.fn();
    const onClear = jest.fn();
    const events: GameEvent[] = [{ type: "moonShot", shooter: 1 }];

    const { rerender } = renderHook(
      ({ evts }: { evts: readonly GameEvent[] }) =>
        useGameEvents(evts, { moonShot: onMoonShot }, onClear),
      { initialProps: { evts: events } }
    );

    // Same array reference — must not re-fire.
    rerender({ evts: events });

    expect(onMoonShot).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("processes a new events array after the previous one was cleared", () => {
    const onMoonShot = jest.fn();
    const onClear = jest.fn();
    const first: GameEvent[] = [{ type: "moonShot", shooter: 0 }];
    const second: GameEvent[] = [{ type: "moonShot", shooter: 3 }];

    const { rerender } = renderHook(
      ({ evts }: { evts: readonly GameEvent[] }) =>
        useGameEvents(evts, { moonShot: onMoonShot }, onClear),
      { initialProps: { evts: first } }
    );

    rerender({ evts: second });

    expect(onMoonShot).toHaveBeenCalledTimes(2);
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when events is undefined", () => {
    const onMoonShot = jest.fn();
    const onClear = jest.fn();

    renderHook(() => useGameEvents(undefined, { moonShot: onMoonShot }, onClear));

    expect(onMoonShot).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it("is a no-op when events is empty", () => {
    const onMoonShot = jest.fn();
    const onClear = jest.fn();

    renderHook(() => useGameEvents([], { moonShot: onMoonShot }, onClear));

    expect(onMoonShot).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it("silently skips events with no registered handler", () => {
    const onClear = jest.fn();
    const events: GameEvent[] = [{ type: "moonShot", shooter: 0 }];

    // No moonShot handler registered — should not throw.
    expect(() =>
      renderHook(() => useGameEvents(events, { heartsBroken: jest.fn() }, onClear))
    ).not.toThrow();

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
