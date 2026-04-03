#!/usr/bin/env node
/**
 * Pre-build script: queries the Render API for the API backend's public URL
 * and writes EXPO_PUBLIC_API_URL to .env so Expo bakes the correct value
 * into the static bundle at build time.
 *
 * If EXPO_PUBLIC_API_URL is already set (e.g. via render.yaml fromService or
 * the Render dashboard), the script writes it to .env and exits immediately
 * without calling the Render API.
 *
 * Fallback env vars (only used when EXPO_PUBLIC_API_URL is not set):
 *   RENDER_API_KEY          — Render API key (sensitive, never commit)
 *   RENDER_API_SERVICE_NAME — name of the API service to look up (default: "gaming-app-api")
 *
 * Usage (called automatically by render.yaml buildCommand):
 *   node scripts/fetch-render-env.js
 */

import { writeFileSync } from "fs";

// If EXPO_PUBLIC_API_URL is already set (e.g. via the Render dashboard),
// write it straight to .env and skip the API lookup entirely.
const existingUrl = process.env.EXPO_PUBLIC_API_URL;
if (existingUrl) {
  writeFileSync(".env", `EXPO_PUBLIC_API_URL=${existingUrl}\n`);
  console.log(`✓ EXPO_PUBLIC_API_URL=${existingUrl} (from environment)`);
  process.exit(0);
}

const API_KEY = process.env.RENDER_API_KEY;
const SERVICE_NAME = process.env.RENDER_API_SERVICE_NAME ?? "gaming-app-api";

if (!API_KEY) {
  console.error(
    "Error: RENDER_API_KEY is not set and EXPO_PUBLIC_API_URL is not set.\n" +
      "Set EXPO_PUBLIC_API_URL directly, or add RENDER_API_KEY as a secret env var\n" +
      "on the gaming-app-frontend service in the Render dashboard."
  );
  process.exit(1);
}

const res = await fetch("https://api.render.com/v1/services?limit=50", {
  headers: { Authorization: `Bearer ${API_KEY}` },
});

if (!res.ok) {
  console.error(`Render API request failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const services = await res.json();
const match = services.find((s) => s.service?.name === SERVICE_NAME);

if (!match) {
  const names = services.map((s) => s.service?.name).join(", ");
  console.error(`Service "${SERVICE_NAME}" not found. Available services: ${names}`);
  process.exit(1);
}

const url = match.service?.serviceDetails?.url;
if (!url || !url.startsWith("http")) {
  console.error(`Service "${SERVICE_NAME}" has no valid public URL: ${JSON.stringify(url)}`);
  process.exit(1);
}

writeFileSync(".env", `EXPO_PUBLIC_API_URL=${url}\n`);
console.log(`✓ EXPO_PUBLIC_API_URL=${url}`);
