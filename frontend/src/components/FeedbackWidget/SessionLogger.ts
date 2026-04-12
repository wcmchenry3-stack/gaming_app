/**
 * SessionLogger — lightweight circular buffer that captures recent console
 * warnings and errors so they can be attached to feedback submissions.
 *
 * Call `SessionLogger.init()` once at app startup (before any other imports
 * that might log). The buffer wraps at MAX_ENTRIES so memory use is bounded.
 */

const MAX_ENTRIES = 200;

interface LogEntry {
  level: 'warn' | 'error';
  ts: string; // ISO timestamp
  msg: string;
}

const buffer: LogEntry[] = [];
let initialised = false;
// Save originals so _reset() can fully undo the patch (used in tests)
let originalWarn: typeof console.warn | null = null;
let originalError: typeof console.error | null = null;

function push(level: LogEntry['level'], args: unknown[]): void {
  const msg = args
    .map((a) =>
      typeof a === 'string'
        ? a
        : a instanceof Error
          ? `${a.name}: ${a.message}`
          : JSON.stringify(a),
    )
    .join(' ');

  if (buffer.length >= MAX_ENTRIES) {
    buffer.shift();
  }
  buffer.push({ level, ts: new Date().toISOString(), msg });
}

export const SessionLogger = {
  /**
   * Patch console.warn and console.error to also write into the buffer.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init(): void {
    if (initialised) return;
    initialised = true;

    originalWarn = console.warn.bind(console);
    originalError = console.error.bind(console);

    console.warn = (...args: unknown[]) => {
      push('warn', args);
      originalWarn!(...args);
    };

    console.error = (...args: unknown[]) => {
      push('error', args);
      originalError!(...args);
    };
  },

  /**
   * Return the buffer as a plain-text string suitable for attaching to a
   * GitHub issue. Most recent entries are at the bottom.
   */
  getLogs(): string {
    return buffer.map((e) => `[${e.ts}] ${e.level.toUpperCase()} ${e.msg}`).join('\n');
  },

  /** Expose entry count — used in tests. */
  get size(): number {
    return buffer.length;
  },

  /** Clear the buffer and restore console — used in tests. */
  _reset(): void {
    buffer.length = 0;
    if (initialised && originalWarn && originalError) {
      console.warn = originalWarn;
      console.error = originalError;
    }
    initialised = false;
    originalWarn = null;
    originalError = null;
  },
};
