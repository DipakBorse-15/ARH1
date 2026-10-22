/** Indian mobile number: 10 digits starting 6-9, optional +91 / 91 / 0 in front. */
export function isValidMobile(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  return /^(\+?91|0)?[6-9]\d{9}$/.test(digits);
}
