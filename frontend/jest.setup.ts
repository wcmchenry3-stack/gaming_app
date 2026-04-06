// Gesture handler requires native setup in Jest
import "react-native-gesture-handler/jestSetup";

// Reanimated v4 — the official mock still imports worklets which require a
// native runtime. Instead we supply a minimal stub covering the hooks used
// in AnimatedTile.tsx (useSharedValue, useAnimatedStyle, withTiming, etc.).
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  const sharedValue = (init: unknown) => ({ value: init });
  const noopAnim = (v: unknown) => v;

  const createAnimatedComponent = (Component: React.ComponentType) => {
    const Wrapped = React.forwardRef((props: object, ref: unknown) =>
      React.createElement(Component, { ...props, ref })
    );
    Wrapped.displayName = "AnimatedComponent";
    return Wrapped;
  };

  const AnimatedView = createAnimatedComponent(View);
  const AnimatedText = createAnimatedComponent(Text);

  return {
    __esModule: true,
    default: {
      View: AnimatedView,
      Text: AnimatedText,
      createAnimatedComponent,
    },
    // Named exports used directly in AnimatedTile.tsx
    useSharedValue: sharedValue,
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: noopAnim,
    withSequence: (...args: unknown[]) => args[args.length - 1],
    withDelay: (_ms: number, v: unknown) => v,
    Easing: {
      out: () => () => 0,
      in: () => () => 0,
      quad: () => 0,
    },
    runOnJS: (fn: unknown) => fn,
    createAnimatedComponent,
    // Used internally by react-native-gesture-handler
    useEvent: () => () => {},
    useHandler: (_handlers: unknown, deps: unknown[]) => [() => {}, deps],
    useAnimatedRef: () => ({ current: null }),
    useAnimatedReaction: () => {},
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useWorkletCallback: (fn: unknown) => fn,
    makeRemote: (obj: unknown) => obj,
    makeShareable: (obj: unknown) => obj,
    startMapper: () => 0,
    stopMapper: () => {},
  };
});

// Sentry mock — @sentry/react-native ships ESM that Jest can't transform
jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  init: jest.fn(),
  wrap: (c: unknown) => c,
  ReactNavigationInstrumentation: jest.fn(),
  ReactNativeTracing: jest.fn(),
}));

// AsyncStorage mock (replaces localStorage in ThemeContext / FruitSetContext)
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// English namespace fixtures for testing
import common from "./src/i18n/locales/en/common.json";
import yacht from "./src/i18n/locales/en/yacht.json";
import cascade from "./src/i18n/locales/en/cascade.json";
import errors from "./src/i18n/locales/en/errors.json";
import blackjack from "./src/i18n/locales/en/blackjack.json";
import pachisi from "./src/i18n/locales/en/pachisi.json";
import twenty48 from "./src/i18n/locales/en/twenty48.json";

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  ns: ["common", "yacht", "cascade", "errors", "blackjack", "pachisi", "twenty48"],
  defaultNS: "common",
  resources: {
    en: {
      common,
      yacht,
      cascade,
      errors,
      blackjack,
      pachisi,
      twenty48,
    },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
