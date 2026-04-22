import * as Sentry from "@sentry/react-native";
import {
  installSentryConsoleErrorCapture,
  _resetSentryConsoleErrorCaptureForTests,
} from "../sentryConsoleError";

jest.mock("@sentry/react-native", () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

describe("installSentryConsoleErrorCapture", () => {
  const originalError = console.error;

  afterEach(() => {
    _resetSentryConsoleErrorCaptureForTests();
    console.error = originalError;
    jest.clearAllMocks();
  });

  it("forwards plain-string console.error calls to Sentry.captureMessage", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    installSentryConsoleErrorCapture();

    console.error("duplicate key", "warning");

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "duplicate key warning",
      expect.objectContaining({
        level: "error",
        tags: expect.objectContaining({ source: "console.error" }),
      })
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("forwards Error instances via Sentry.captureException", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    installSentryConsoleErrorCapture();

    const err = new Error("boom");
    console.error("prefix:", err);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        tags: expect.objectContaining({ source: "console.error" }),
      })
    );
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("still calls the original console.error so output is preserved", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    installSentryConsoleErrorCapture();

    console.error("hello");

    expect(spy).toHaveBeenCalledWith("hello");
    spy.mockRestore();
  });

  it("is idempotent — calling install twice does not double-wrap", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    installSentryConsoleErrorCapture();
    installSentryConsoleErrorCapture();

    console.error("once");

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("does not swallow the original log when Sentry.captureMessage throws", () => {
    (Sentry.captureMessage as jest.Mock).mockImplementation(() => {
      throw new Error("sentry down");
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    installSentryConsoleErrorCapture();

    expect(() => console.error("still logs")).not.toThrow();
    expect(spy).toHaveBeenCalledWith("still logs");
    spy.mockRestore();
  });
});
