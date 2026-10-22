// Cart for visitors who are not signed in. Kept in this browser only (localStorage) and moved into the
// customer's real cart the moment they sign in.

const KEY = "aaraah_guest_cart";

export interface GuestLine {
  variant_id: string;
  quantity: number;
}

export function readGuestCart(): GuestLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.variant_id === "string" && Number.isInteger(l.quantity) && l.quantity > 0)
      .map((l) => ({ variant_id: l.variant_id as string, quantity: l.quantity as number }));
  } catch {
    return [];
  }
}

export function writeGuestCart(lines: GuestLine[]): void {
  try {
    if (lines.length) localStorage.setItem(KEY, JSON.stringify(lines));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode etc. — the cart then lives only until the page is closed */
  }
}
