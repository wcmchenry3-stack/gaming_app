#!/usr/bin/env node
/**
 * Pre-build script: writes EXPO_PUBLIC_API_URL (and any other EXPO_PUBLIC_*
 * env vars) into .env so Expo bakes the correct values into the static bundle
 * at build time.
 *
 * The URL is set directly in render.yaml (pointing to the custom domain).
 * This script merges it into .env without overwriting other keys already
 * present (e.g. EXPO_PUBLIC_SENTRY_DSN).
 *
 * Usage (called automatically by render.yaml buildCommand):
 *   node scripts/fetch-render-env.js
 */

import { readFileSync, writeFileSync } from "fs";

// Read the existing .env so we can merge new values without losing keys
// like EXPO_PUBLIC_SENTRY_DSN that are already present.
let existingEnv = {};
try {
  const content = readFileSync(".env", "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
    if (match) existingEnv[match[1]] = match[2];
  }
} catch {
  // .env may not exist yet — that's fine
}

function writeEnv(vars) {
  const merged = { ...existingEnv, ...vars };
  const content = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";
  writeFileSync(".env", content);
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  console.error(
    "Error: EXPO_PUBLIC_API_URL is not set.\n" +
      "Set it in render.yaml or as an env var in the Render dashboard."
  );
  process.exit(1);
}

const url = apiUrl.startsWith("http") ? apiUrl : `https://${apiUrl}`;

const vars = { EXPO_PUBLIC_API_URL: url };

// Forward EXPO_PUBLIC_SENTRY_DSN from the environment if present
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  vars.EXPO_PUBLIC_SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
}

writeEnv(vars);
console.log(`✓ EXPO_PUBLIC_API_URL=${url}`);
