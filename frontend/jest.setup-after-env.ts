// Runs after the test framework is installed (expect/jest globals available).
// Bump testing-library's async default (1000ms) — the first render in a suite
// pays cold-JIT cost that can exceed 1s on local first-runs and CI, causing
// flaky findBy*/waitFor failures. 5000ms matches the per-call overrides
// already sprinkled through the suite.
import { configure } from "@testing-library/react-native";
configure({ asyncUtilTimeout: 5000 });
