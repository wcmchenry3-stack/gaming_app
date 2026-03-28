/**
 * @jest-environment node
 *
 * render.yaml deployment config guard
 * ------------------------------------
 * Verifies that EXPO_PUBLIC_API_URL is sourced from a service using
 * `property: url` (the public HTTPS URL) rather than `property: host`
 * (the Render-internal hostname that is not DNS-resolvable from browsers).
 *
 * Regression test for the production bug where all API-dependent games
 * (Yahtzee, Blackjack, Ludo) failed with ERR_NAME_NOT_RESOLVED because
 * `property: host` injected a bare hostname like "yahtzee-api".
 */

import * as fs from "fs";
import * as path from "path";

const renderYamlPath = path.resolve(__dirname, "../../../render.yaml");
const renderYaml = fs.readFileSync(renderYamlPath, "utf-8");

describe("render.yaml deployment configuration", () => {
  it("EXPO_PUBLIC_API_URL uses property: url, not property: host", () => {
    // Find the EXPO_PUBLIC_API_URL block and assert it uses "url" not "host"
    const envVarBlock = renderYaml.match(/EXPO_PUBLIC_API_URL[\s\S]*?property:\s*(\w+)/);
    expect(envVarBlock).not.toBeNull();
    const propertyValue = envVarBlock![1];
    expect(propertyValue).toBe("url");
  });

  it("no fromService env var uses property: host (internal-only hostname)", () => {
    // property: host gives a bare hostname (e.g. "yahtzee-api") that only
    // resolves inside Render's private network — unusable from a browser.
    const hostMatches = renderYaml.match(/fromService[\s\S]*?property:\s*host\b/g);
    expect(hostMatches).toBeNull();
  });
});
