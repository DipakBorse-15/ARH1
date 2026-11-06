/**
 * Indian mobile number rule — the ONE rule used everywhere (Register, Account, Checkout,
 * Saved addresses). The `create-order` Edge Function carries a copy of the same rule: keep them in sync.
 *
 * Accepts: 9876543210, +91 98765 43210, 91-98765-43210, 098765 43210, (98765) 43210 ...
 * Rule: 10 digits starting 6-9, optional +91 / 91 / 0 in front.
 */
const MOBILE_RE = /^(?:\+?91|0)?([6-9]\d{9})$/;

/** Returns the plain 10-digit number (no +91 / 0), or null when the input is not a valid Indian mobile. */
export function normalizeMobile(value: string | null | undefined): string | null {
  const compact = String(value ?? "").replace(/[\s\-().]/g, "");
  const m = MOBILE_RE.exec(compact);
  return m ? m[1] : null;
}

export function isValidMobile(value: string | null | undefined): boolean {
  return normalizeMobile(value) !== null;
}
