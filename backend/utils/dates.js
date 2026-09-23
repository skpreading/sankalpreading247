// Adds `n` months to a date, returning a new Date (does not mutate input).
function addMonths(date, n = 1) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

module.exports = { addMonths };
