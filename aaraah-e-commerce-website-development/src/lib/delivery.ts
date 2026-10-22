/** Adds working days (Monday to Saturday; Sunday is skipped). */
function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Delivery window as promised in the Shipping Policy: dispatched in 1–3 working days after
 * payment is confirmed, then 5–7 working days to deliver.
 */
export function deliveryWindowText(from: Date = new Date()): string {
  return `${fmt(addWorkingDays(from, 6))} – ${fmt(addWorkingDays(from, 10))}`;
}
