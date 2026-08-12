const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Parses simple duration strings like '15m', '7d', '1h' into milliseconds.
 * Only supports the handful of units actually used by JWT_*_EXPIRY env
 * vars — not a general-purpose duration parser, so it doesn't need to be
 * a dependency.
 */
export function parseDurationToMs(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration format: "${duration}" (expected e.g. "15m", "7d")`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
