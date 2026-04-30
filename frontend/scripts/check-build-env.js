#!/usr/bin/env node
/**
 * Build-time guard: asserts EXPO_PUBLIC_API_URL is set and non-localhost
 * for production exports. Run before `expo export` in any CI/CD pipeline
 * that targets production or staging. See issue #1095.
 */

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalhost(url) {
  try {
    const { hostname } = new URL(url);
    return LOCALHOST_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

const raw = process.env.EXPO_PUBLIC_API_URL;
const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
const isProduction = appEnv === "production" || appEnv === "staging";

if (!isProduction) {
  process.exit(0);
}

const errors = [];

if (!raw) {
  errors.push("EXPO_PUBLIC_API_URL is not set. Expo bakes this into the bundle at export time.");
}

if (raw && isLocalhost(raw)) {
  errors.push(`EXPO_PUBLIC_API_URL resolves to localhost (${raw}). Set it to the production API URL.`);
}

if (process.env.EXPO_PUBLIC_TEST_HOOKS === "1") {
  errors.push("EXPO_PUBLIC_TEST_HOOKS=1 is set in a production/staging build. Remove it from Render env vars.");
}

if (errors.length > 0) {
  console.error("[check-build-env] Build env validation FAILED:");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log(`[check-build-env] OK — EXPO_PUBLIC_API_URL=${raw}, APP_ENV=${appEnv}`);
