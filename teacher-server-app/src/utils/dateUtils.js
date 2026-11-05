/**
 * ============================================================================
 * EXAMSHIELD LAN - CENTRALIZED DATE UTILITIES (DRY)
 * ============================================================================
 * Provides deterministic, timezone-aware local date and time formatting
 * across all exporters, audit logs, and API payloads without UTC offset bugs.
 * ============================================================================
 */

/**
 * Parses any incoming timestamp string or object into a local Date.
 * Properly converts SQLite UTC strings ('YYYY-MM-DD HH:MM:SS') to ISO UTC.
 *
 * @param {Date|string|number} val - Input timestamp
 * @returns {Date|null} - Parsed Date object, or null if invalid
 */
function parseToLocalDate(val) {
  if (!val) return null;
  let d;
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) {
      d = new Date(val.replace(' ', 'T') + 'Z');
    } else {
      d = new Date(val);
    }
  } else {
    d = new Date(val);
  }
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a timestamp into 12-hour local time: 'HH:MM:SS AM/PM'.
 *
 * @param {Date|string|number} val - Input timestamp
 * @returns {string} - Formatted time string
 */
function formatLocalTime(val) {
  const d = parseToLocalDate(val);
  if (!d) return '-';
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = String(hh % 12 || 12).padStart(2, '0');
  return `${h12}:${mm}:${ss} ${ampm}`;
}

/**
 * Formats a timestamp into local date and time: 'YYYY-MM-DD HH:MM:SS AM/PM'.
 *
 * @param {Date|string|number} val - Input timestamp
 * @returns {string} - Formatted full date-time string
 */
function formatDateTime(val = new Date()) {
  const d = parseToLocalDate(val);
  if (!d) return String(val);
  const pad = n => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = pad(hours % 12 || 12);
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}-${month}-${day} ${h12}:${mins}:${secs} ${ampm}`;
}

/**
 * Formats a timestamp for Excel/CSV display: 'DD/MM/YYYY, HH:MM:SS AM/PM'.
 *
 * @param {Date|string|number} val - Input timestamp
 * @returns {string} - Formatted local date-time string
 */
function formatLocalDateTime(val) {
  const d = parseToLocalDate(val);
  if (!d) return '-';
  return d.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

module.exports = {
  parseToLocalDate,
  formatLocalTime,
  formatDateTime,
  formatLocalDateTime
};
