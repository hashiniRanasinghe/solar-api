const { FIELD_ERROR } = require('./errors');

// ISO 8601 in UTC only: date, time to the minute, optional seconds and
// milliseconds, and a trailing Z. Offsets and date-only values are refused.
const UTC_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z$/;

// Returns a Date, or null when the value is not an accepted UTC timestamp or
// names a time that does not exist (for example 2026-02-30).
function parseUtcTimestamp(value) {
  if (typeof value !== 'string') return null;
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) return null;

  const [year, month, day, hour, minute, second = '0', ms = '0'] = match.slice(1);
  const date = new Date(value);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCHours() !== Number(hour) ||
    date.getUTCMinutes() !== Number(minute) ||
    date.getUTCSeconds() !== Number(second) ||
    date.getUTCMilliseconds() !== Number(ms.padEnd(3, '0'))
  ) {
    return null;
  }
  return date;
}

// Reads from and to (both inclusive, either optional) from the query and
// returns a filter on timestamp. Bad values are pushed onto errors.
function parseTimeWindow(query, errors) {
  const bounds = {};

  for (const [name, operator, code] of [
    ['from', '$gte', FIELD_ERROR.from],
    ['to', '$lte', FIELD_ERROR.to],
  ]) {
    if (query[name] === undefined) continue;
    const date = parseUtcTimestamp(query[name]);
    if (date) {
      bounds[operator] = date;
    } else {
      errors.push({
        code,
        message: `${name} must be an ISO 8601 UTC timestamp such as 2026-09-20T00:00:00Z`,
      });
    }
  }

  if (bounds.$gte && bounds.$lte && bounds.$gte > bounds.$lte) {
    errors.push({ code: FIELD_ERROR.timeWindow, message: 'from must not be later than to' });
  }

  return Object.keys(bounds).length > 0 ? { timestamp: bounds } : {};
}

// The Asia/Colombo calendar day that contains now (a time in ms). Sri Lanka is
// fixed at UTC+05:30 with no daylight saving, so the day is computed from the
// offset and never from the server timezone. Returns the local date
// (YYYY-MM-DD) and the UTC instant of local 00:00.
const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function colomboDay(now) {
  const local = now + COLOMBO_OFFSET_MS;
  const localMidnight = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
  return {
    date: new Date(localMidnight).toISOString().slice(0, 10),
    start: new Date(localMidnight - COLOMBO_OFFSET_MS),
  };
}

module.exports = { parseTimeWindow, parseUtcTimestamp, colomboDay };
