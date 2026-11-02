const whole = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const short = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const units = [
  { threshold: 1e12, label: 'T' },
  { threshold: 1e9, label: 'M' },
  { threshold: 1e6, label: 'jt' },
];

// Display rounding only; stored amounts, validation, and exports stay in whole rupiah.
export function moneyParts(value: number, compact = true) {
  const absolute = Math.abs(value);
  let index = compact ? units.findIndex((unit) => absolute >= unit.threshold) : -1;
  if (index < 0) return { number: whole.format(absolute), unit: '' };
  let rounded = Math.round(absolute / (units[index].threshold / 100)) / 100;
  if (rounded >= 1000 && index > 0) {
    index -= 1;
    rounded = Math.round(absolute / (units[index].threshold / 100)) / 100;
  }
  return { number: short.format(rounded), unit: units[index].label };
}
