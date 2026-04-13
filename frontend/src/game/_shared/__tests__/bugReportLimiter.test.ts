import { BugReportLimiter } from "../bugReportLimiter";
import { logConfig, resetLogConfig } from "../eventQueueConfig";

describe("BugReportLimiter", () => {
  let limiter: BugReportLimiter;

  beforeEach(() => {
    resetLogConfig();
    limiter = new BugReportLimiter();
  });

  afterEach(() => {
    resetLogConfig();
  });

  it("allows up to BURST_ALLOWANCE calls immediately", () => {
    logConfig.REPORT_BUG_BURST_ALLOWANCE = 5;
    logConfig.REPORT_BUG_MAX_PER_MINUTE_PER_SOURCE = 0; // no refill
    const results = Array.from({ length: 7 }, () => limiter.tryConsume("src", 1000));
    expect(results.filter(Boolean).length).toBe(5);
    expect(results.filter((r) => !r).length).toBe(2);
  });

  it("refills at MAX_PER_MINUTE rate", () => {
    logConfig.REPORT_BUG_BURST_ALLOWANCE = 2;
    logConfig.REPORT_BUG_MAX_PER_MINUTE_PER_SOURCE = 60; // 1 token / sec
    // Burn the burst.
    expect(limiter.tryConsume("src", 0)).toBe(true);
    expect(limiter.tryConsume("src", 0)).toBe(true);
    expect(limiter.tryConsume("src", 0)).toBe(false);

    // After 1s → 1 token refilled.
    expect(limiter.tryConsume("src", 1000)).toBe(true);
    expect(limiter.tryConsume("src", 1000)).toBe(false);

    // After 2s more → cap at 2 (burst allowance).
    expect(limiter.tryConsume("src", 5000)).toBe(true);
    expect(limiter.tryConsume("src", 5000)).toBe(true);
    expect(limiter.tryConsume("src", 5000)).toBe(false);
  });

  it("isolates buckets per source", () => {
    logConfig.REPORT_BUG_BURST_ALLOWANCE = 1;
    logConfig.REPORT_BUG_MAX_PER_MINUTE_PER_SOURCE = 0;
    expect(limiter.tryConsume("a", 0)).toBe(true);
    expect(limiter.tryConsume("a", 0)).toBe(false);
    // Different source still has its own full bucket.
    expect(limiter.tryConsume("b", 0)).toBe(true);
  });

  it("reset clears all buckets", () => {
    logConfig.REPORT_BUG_BURST_ALLOWANCE = 1;
    logConfig.REPORT_BUG_MAX_PER_MINUTE_PER_SOURCE = 0;
    limiter.tryConsume("src", 0);
    expect(limiter.tryConsume("src", 0)).toBe(false);
    limiter.reset();
    expect(limiter.tryConsume("src", 0)).toBe(true);
  });
});
