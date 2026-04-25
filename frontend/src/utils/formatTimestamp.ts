/**
 * Timestamp display utilities — always use these, never toISOString() or
 * manual offset arithmetic. The device's local timezone is applied
 * automatically by the JS runtime when you pass a Date to toLocaleString /
 * toLocaleDateString.
 *
 * Pattern:
 *   const d = new Date(isoUtcString);   // parses ISO-8601 → local TZ
 *   return d.toLocaleString();           // renders in device local TZ
 */

/**
 * Full date + time in the device's local timezone.
 * Returns "—" for null or an unparseable string.
 */
export function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/**
 * Short date (e.g. "Jun 15, 2024") in the device's local timezone.
 * Returns "" for null or an unparseable string.
 */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
