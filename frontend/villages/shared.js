/**
 * Clamp and format a health score (0..1) as a percentage.
 *
 * @param {number | null | undefined} value
 * @returns {string}
 */
export function formatHealthScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  const clamped = Math.max(0, Math.min(1, value));
  return `${Math.round(clamped * 100)}%`;
}

/**
 * Format an ISO timestamp as a localized date.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatDate(value) {
  if (!value) {
    return '—';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.warn('Unable to format date', value, error);
    return '—';
  }
}
