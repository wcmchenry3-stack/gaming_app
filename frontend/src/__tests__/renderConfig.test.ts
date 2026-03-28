/**
 * @jest-environment node
 *
 * render.yaml deployment config guard
 * ------------------------------------
 * Verifies that the frontend build uses fetch-render-env.js to dynamically
 * resolve the API URL via the Render API, rather than hardcoding it or using
 * Render's fromService reference (which returns a bare slug, not a full URL).
 *
 * Regression test for the production bug where all API-dependent games
 * (Yahtzee, Blackjack, Ludo) failed with ERR_NAME_NOT_RESOLVED.
 */

import * as fs from "fs";
import * as path from "path";

const renderYamlPath = path.resolve(__dirname, "../../../render.yaml");
const renderYaml = fs.readFileSync(renderYamlPath, "utf-8");

describe("render.yaml deployment configuration", () => {
  it("frontend buildCommand runs fetch-render-env.js before expo export", () => {
    // The script queries the Render API at build time so the URL is always correct.
    // Find the line that contains expo export and assert the script precedes it.
    const scriptIdx = renderYaml.indexOf("fetch-render-env.js");
    const exportIdx = renderYaml.indexOf("expo export");
    expect(scriptIdx).toBeGreaterThan(-1);
    expect(exportIdx).toBeGreaterThan(scriptIdx);
  });

  it("EXPO_PUBLIC_API_URL is not hardcoded in render.yaml", () => {
    // The value must come from the Render API at build time, not be baked into render.yaml.
    expect(renderYaml).not.toMatch(/EXPO_PUBLIC_API_URL[\s\S]*?value:\s*https?:\/\//);
  });

  it("no fromService env var uses property: host (internal-only hostname)", () => {
    // property: host gives a bare hostname (e.g. "yahtzee-api") that only
    // resolves inside Render's private network — unusable from a browser.
    const hostMatches = renderYaml.match(/fromService[\s\S]*?property:\s*host\b/g);
    expect(hostMatches).toBeNull();
  });
});
