const DURATION_MULTIPLIERS = new Map<string, number>([
  ['s', 1_000],
  ['m', 60_000],
  ['h', 3_600_000],
  ['d', 86_400_000],
  ['w', 7 * 86_400_000],
]);

/**
 * Parse a compact duration string (e.g. `'15m'`, `'7d'`) into milliseconds.
 *
 * Supported units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks).
 *
 * @param duration - compact duration string such as `'30s'` or `'7d'`
 * @param fallbackMs - value returned when `duration` cannot be parsed (default: 7 days)
 * @returns duration in milliseconds
 */
export function parseDurationMs(duration: string, fallbackMs = 7 * 86_400_000): number {
  const match = /^(\d+)([smhdw])$/.exec(duration);
  if (!match) return fallbackMs;
  const [, digits = '0', unit = 'd'] = match;
  return parseInt(digits, 10) * (DURATION_MULTIPLIERS.get(unit) ?? 86_400_000);
}
