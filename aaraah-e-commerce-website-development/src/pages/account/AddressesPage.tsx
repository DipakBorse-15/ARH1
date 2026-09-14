import { useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { AccountNav } from "@/components/account/AccountNav";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { fetchAddresses, upsertAddress, deleteAddress } from "@/services/addresses";
import { friendlyError } from "@/lib/supabase";
import type { Address } from "@/types";

const EMPTY: Partial<Address> = { full_name: "", mobile: "", line1: "", line2: "", city: "", state: "", pincode: "" };

export default function AddressesPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Address>>(EMPTY);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      setAddresses(await fetchAddresses(user.id));
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    try {
      await upsertAddress({ ...form, user_id: user.id });
      setForm(EMPTY);
      setShowForm(false);
      show("Address saved", "success");
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAddress(id);
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <SEO title="My Addresses" canonicalPath="/account/addresses" />
      <h1 className="mb-4 font-serif text-3xl font-semibold text-stone-900">My Account</h1>
      <AccountNav />

      {loading && <LoadingState />}

      {!loading && (
        <>
          <div className="mb-6 space-y-3">
            {addresses.map((a) => (
              <div key={a.id} className="flex items-start justify-between rounded-xl border border-stone-200 p-4">
                <div className="text-sm text-stone-600">
                  <p className="font-medium text-stone-900">{a.full_name}</p>
                  <p>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                  </p>
                  <p>{a.mobile}</p>
                </div>
                <button onClick={() => handleDelete(a.id)} className="text-xs font-medium text-rose-700 hover:underline">
                  Remove
                </button>
              </div>
            ))}
            {addresses.length === 0 && <EmptyState title="No saved addresses" message="Add an address to speed up checkout." />}
          </div>

          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
              + Add new address
            </button>
          ) : (
            <form onSubmit={handleSave} className="grid gap-3 rounded-2xl border border-stone-200 p-5 sm:grid-cols-2">
              <input placeholder="Full name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} />
              <input placeholder="Mobile" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className={inputClass} />
              <input placeholder="Address line 1" required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className={`${inputClass} sm:col-span-2`} />
              <input placeholder="Address line 2 (optional)" value={form.line2 ?? ""} onChange={(e) => setForm({ ...form, line2: e.target.value })} className={`${inputClass} sm:col-span-2`} />
              <input placeholder="City" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} />
              <input placeholder="State" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputClass} />
              <input placeholder="Pincode" required value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className={inputClass} />
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white">
                  Save address
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-stone-300 px-5 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

const inputClass = "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none";
