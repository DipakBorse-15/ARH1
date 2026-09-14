import { supabase } from "@/lib/supabase";
import type { Address } from "@/types";

export async function fetchAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase.from("addresses").select("*").eq("user_id", userId).order("is_default", { ascending: false });
  if (error) throw error;
  return data as Address[];
}

export async function upsertAddress(address: Partial<Address>): Promise<Address> {
  const { data, error } = await supabase.from("addresses").upsert(address).select().single();
  if (error) throw error;
  return data as Address;
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw error;
}
