import { renderHook, act } from "@testing-library/react-native";
import React from "react";
import { SoundProvider } from "../SoundContext";
import { useBackgroundMusic } from "../useBackgroundMusic";
import { SOUND_REGISTRY } from "../sounds";

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn();
const mockRemove = jest.fn();

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({
    play: mockPlay,
    pause: mockPause,
    seekTo: mockSeekTo,
    remove: mockRemove,
    set loop(_: boolean) {},
    set volume(_: number) {},
  })),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(SoundProvider, null, children);
}

const TEST_KEY = "test.bg1";

beforeEach(() => {
  jest.clearAllMocks();
  SOUND_REGISTRY[TEST_KEY] = 1 as unknown as number;
});

afterEach(() => {
  delete SOUND_REGISTRY[TEST_KEY];
});

describe("useBackgroundMusic — unmount cleanup", () => {
  it("calls pause() before remove() on unmount while music is active", () => {
    const callOrder: string[] = [];
    mockPause.mockImplementation(() => callOrder.push("pause"));
    mockRemove.mockImplementation(() => callOrder.push("remove"));

    const { unmount } = renderHook(() => useBackgroundMusic([TEST_KEY], true), { wrapper });
    unmount();

    expect(callOrder).toEqual(["pause", "remove"]);
  });

  it("calls pause() before remove() on unmount even when active is false", () => {
    const callOrder: string[] = [];
    mockPause.mockImplementation(() => callOrder.push("pause"));
    mockRemove.mockImplementation(() => callOrder.push("remove"));

    const { rerender, unmount } = renderHook(
      ({ active }: { active: boolean }) => useBackgroundMusic([TEST_KEY], active),
      { wrapper, initialProps: { active: true } }
    );
    act(() => {
      rerender({ active: false });
    });
    unmount();

    expect(callOrder).toEqual(["pause", "pause", "remove"]);
  });
});

describe("useBackgroundMusic — active flag", () => {
  it("plays on mount when active is true", () => {
    renderHook(() => useBackgroundMusic([TEST_KEY], true), { wrapper });
    expect(mockPlay).toHaveBeenCalled();
  });

  it("pauses when active transitions to false", () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useBackgroundMusic([TEST_KEY], active),
      { wrapper, initialProps: { active: true } }
    );
    act(() => {
      rerender({ active: false });
    });
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it("does not start playback when active is false on mount", () => {
    renderHook(() => useBackgroundMusic([TEST_KEY], false), { wrapper });
    expect(mockPlay).not.toHaveBeenCalled();
  });
});
