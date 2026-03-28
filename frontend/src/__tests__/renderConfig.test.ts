/**
 * @jest-environment node
 *
 * render.yaml deployment config guard
 * ------------------------------------
 * Verifies that EXPO_PUBLIC_API_URL is set to a hardcoded full HTTPS URL
 * rather than a bare hostname from a fromService reference.
 *
 * Regression test for the production bug where all API-dependent games
 * (Yahtzee, Blackjack, Ludo) failed with ERR_NAME_NOT_RESOLVED because
 * Render's fromService resolved to the internal hostname "yahtzee-api"
 * instead of the public URL "https://yahtzee-api.onrender.com".
 */

import * as fs from "fs";
import * as path from "path";

const renderYamlPath = path.resolve(__dirname, "../../../render.yaml");
const renderYaml = fs.readFileSync(renderYamlPath, "utf-8");

describe("render.yaml deployment configuration", () => {
  it("EXPO_PUBLIC_API_URL is set to a hardcoded full HTTPS URL", () => {
    // Match: EXPO_PUBLIC_API_URL followed by value: https://...
    const valueMatch = renderYaml.match(/EXPO_PUBLIC_API_URL[\s\S]*?value:\s*(https?:\/\/\S+)/);
    expect(valueMatch).not.toBeNull();
    const url = valueMatch![1];
    expect(url).toMatch(/^https:\/\/.+/);
  });

  it("no fromService env var uses property: host (internal-only hostname)", () => {
    // property: host gives a bare hostname (e.g. "yahtzee-api") that only
    // resolves inside Render's private network — unusable from a browser.
    const hostMatches = renderYaml.match(/fromService[\s\S]*?property:\s*host\b/g);
    expect(hostMatches).toBeNull();
  });
});
