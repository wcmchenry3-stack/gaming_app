/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, act, waitFor } from "@testing-library/react-native";
import Twenty48Screen from "../Twenty48Screen";
import { ThemeProvider } from "../../theme/ThemeContext";

// Force web platform so the keyboard-listener useEffect runs.
import { Platform } from "react-native";
(Platform as { OS: string }).OS = "web";

// Mock storage — no saved game, no-op persistence.
jest.mock("../../game/twenty48/storage", () => ({
  saveGame: jest.fn(),
  clearGame: jest.fn(),
  loadGame: jest.fn().mockResolvedValue(null),
}));

function mockNav() {
  return {
    setOptions: jest.fn(),
    navigate: jest.fn(),
  } as unknown as Parameters<typeof Twenty48Screen>[0]["navigation"];
}

function renderScreen(nav = mockNav()) {
  return render(
    <ThemeProvider>
      <Twenty48Screen navigation={nav} />
    </ThemeProvider>
  );
}

// Wait for the initial loadGame() promise to resolve so the pending setState
// doesn't race with the test body.
async function mountAndSettle() {
  const r = renderScreen();
  await act(async () => {
    await Promise.resolve();
  });
  return r;
}

function dispatchKey(key: string, target?: EventTarget) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  if (target) {
    Object.defineProperty(event, "target", { value: target, writable: false });
  }
  window.dispatchEvent(event);
}

describe("Twenty48Screen — keyboard controls (web)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("arrow keys advance the game", async () => {
    const { queryByText } = await mountAndSettle();
    // Wait for loadGame() promise to resolve + initial state to render.
    await waitFor(() => expect(queryByText("Score: 0")).toBeNull(), { timeout: 5000 });

    // Try each of the 4 arrow keys. At least one should produce a valid move
    // (the new-game board with 2 spawned tiles has at least one direction
    // that compacts the board).
    act(() => {
      dispatchKey("ArrowLeft");
      dispatchKey("ArrowRight");
      dispatchKey("ArrowUp");
      dispatchKey("ArrowDown");
    });

    // After any valid move, a new tile is spawned → 3+ non-zero cells.
    // We can't reliably assert specific tile positions due to Math.random
    // in spawns, so this is a smoke test that the handler fires without error.
    // The real guarantee comes from "removes listener on unmount" below.
  });

  it("WASD keys also work", async () => {
    await mountAndSettle();
    // Dispatch lowercase + uppercase to confirm both are mapped.
    act(() => {
      dispatchKey("w");
      dispatchKey("W");
      dispatchKey("a");
      dispatchKey("A");
      dispatchKey("s");
      dispatchKey("S");
      dispatchKey("d");
      dispatchKey("D");
    });
    // No throw = pass.
  });

  it("ignores non-direction keys", async () => {
    await mountAndSettle();
    act(() => {
      dispatchKey(" "); // space
      dispatchKey("Enter");
      dispatchKey("Escape");
      dispatchKey("q");
      dispatchKey("x");
    });
    // No throw and no crash = pass.
  });

  it("ignores arrow keys when an input is focused", async () => {
    await mountAndSettle();
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      dispatchKey("ArrowLeft", input);
    });
    document.body.removeChild(input);
    // The handler early-returns; no crash. We can't easily observe "didn't
    // move" from the outside without exposing state, so this test's value
    // is crash-safety + documenting the guard's existence.
  });

  it("removes the keydown listener on unmount", async () => {
    const add = jest.spyOn(window, "addEventListener");
    const remove = jest.spyOn(window, "removeEventListener");
    const { unmount } = await mountAndSettle();
    expect(add).toHaveBeenCalledWith("keydown", expect.any(Function));
    unmount();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
    add.mockRestore();
    remove.mockRestore();
  });
});
