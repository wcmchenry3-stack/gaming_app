/**
 * @jest-environment node
 *
 * render.yaml deployment config guard
 * ------------------------------------
 * Verifies that the frontend build uses fetch-render-env.js to dynamically
 * resolve the API URL, and that EXPO_PUBLIC_API_URL is wired via Render's
 * fromService (property: host) rather than hardcoded.
 *
 * client.ts normalises bare hostnames returned by fromService into full URLs,
 * so property: host is safe to use.
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
    // The value must come from fromService or the Render API at build time,
    // not be baked into render.yaml as a literal URL.
    expect(renderYaml).not.toMatch(/EXPO_PUBLIC_API_URL[\s\S]*?value:\s*https?:\/\//);
  });

  it("EXPO_PUBLIC_API_URL is wired via fromService", () => {
    // fromService with property: host gives a bare hostname that client.ts
    // normalises to a full URL. This avoids needing RENDER_API_KEY.
    expect(renderYaml).toMatch(/EXPO_PUBLIC_API_URL[\s\S]*?fromService:/);
  });
});
