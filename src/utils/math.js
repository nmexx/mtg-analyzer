/**
 * math.js  –  Pure numerical helpers used across the app.
 */

export const average = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((s, v) => (v != null && !isNaN(v) ? s + v : s), 0);
  return arr.length > 0 ? sum / arr.length : 0;
};

/** Safe toFixed() that returns 0 for falsy/NaN values. */
export const safeToFixed = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) return 0;
  return parseFloat(value.toFixed(decimals));
};
