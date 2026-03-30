import * as SentryReact from "@sentry/react";

// Re-exports a web-safe Sentry surface with the same interface as sentry.native.ts.
// @sentry/react-native uses native modules unavailable in browsers; this shim
// uses @sentry/react instead. Metro resolves .web.ts over .native.ts on web.

export function init(config: Parameters<typeof SentryReact.init>[0]): void {
  SentryReact.init(config);
}

export const ErrorBoundary = SentryReact.ErrorBoundary;

// Sentry.wrap() has no equivalent in @sentry/react — just return the component.
export function wrap<T>(component: T): T {
  return component;
}
