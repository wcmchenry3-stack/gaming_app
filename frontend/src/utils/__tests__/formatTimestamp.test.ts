import { formatTimestamp, formatDate } from "../formatTimestamp";

// A fixed UTC instant: 2024-06-15 20:00:00 UTC.
// In America/New_York (EDT = UTC−4) this is 4:00 PM.
// In Asia/Tokyo (JST = UTC+9) this is 05:00 next day.
// The key invariant: the output must come from the runtime's TZ-aware
// formatter, not from toISOString() or manual offset arithmetic.
const UTC_ISO = "2024-06-15T20:00:00.000Z";

describe("formatTimestamp", () => {
  it("returns — for null", () => {
    expect(formatTimestamp(null)).toBe("—");
  });

  it("returns — for an unparseable string", () => {
    expect(formatTimestamp("not-a-date")).toBe("—");
  });

  it("returns — for empty string", () => {
    expect(formatTimestamp("")).toBe("—");
  });

  it("does not return the raw ISO string (proves toLocaleString, not toISOString)", () => {
    const result = formatTimestamp(UTC_ISO);
    expect(result).not.toBe(UTC_ISO);
    // ISO-8601 markers that should never appear in a locale-formatted date
    expect(result).not.toContain("T");
    expect(result).not.toContain(".000Z");
  });

  it("delegates to Date.prototype.toLocaleString (no manual offset math)", () => {
    const spy = jest.spyOn(Date.prototype, "toLocaleString");
    formatTimestamp(UTC_ISO);
    expect(spy).toHaveBeenCalledTimes(1);
    // Called with no arguments — lets the runtime pick the device locale & TZ.
    expect(spy).toHaveBeenCalledWith();
    spy.mockRestore();
  });

  it("returns a non-empty string for a valid UTC timestamp", () => {
    expect(formatTimestamp(UTC_ISO).length).toBeGreaterThan(0);
  });
});

describe("formatDate", () => {
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns empty string for an unparseable string", () => {
    expect(formatDate("bad")).toBe("");
  });

  it("does not return the raw ISO string", () => {
    const result = formatDate(UTC_ISO);
    expect(result).not.toContain("T");
    expect(result).not.toContain("Z");
    expect(result).not.toMatch(/^\d{4}-\d{2}-\d{2}/); // ISO date fragment
  });

  it("delegates to toLocaleDateString with the canonical options", () => {
    const spy = jest.spyOn(Date.prototype, "toLocaleDateString");
    formatDate(UTC_ISO);
    expect(spy).toHaveBeenCalledWith(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    spy.mockRestore();
  });

  it("includes the year in the output", () => {
    // toLocaleDateString with year:'numeric' must include the year.
    // This would fail if someone switched to toISOString() or dropped the options.
    expect(formatDate(UTC_ISO)).toContain("2024");
  });
});
