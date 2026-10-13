import { supabase } from "@/lib/supabase";
import type { Address } from "@/types";

type AddressFields = Pick<Address, "full_name" | "mobile" | "line1" | "city" | "state" | "pincode"> & { line2?: string | null };

/** Same address typed twice (case / spacing differences) is still ONE address. */
function addressKey(a: AddressFields): string {
  return [a.full_name, a.mobile, a.line1, a.line2 || "", a.city, a.state, a.pincode]
    .map((v) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim())
    .join("|");
}

/** Drops repeats (keeps the first = default/oldest-first order) so old duplicate rows never show twice. */
export function dedupeAddresses(list: Address[]): Address[] {
  const seen = new Set<string>();
  return list.filter((a) => {
    const k = addressKey(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function fetchAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return dedupeAddresses(data as Address[]);
}

export async function upsertAddress(address: Partial<Address>): Promise<Address> {
  const { data, error } = await supabase.from("addresses").upsert(address).select().single();
  if (error) throw error;
  return data as Address;
}

/** Saves an address only if this user does not already have the same one. */
export async function saveAddressIfNew(address: Partial<Address> & AddressFields & { user_id: string }): Promise<void> {
  const existing = await fetchAddresses(address.user_id);
  if (existing.some((a) => addressKey(a) === addressKey(address))) return;
  await upsertAddress({ ...address, is_default: existing.length === 0 });
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw error;
}
