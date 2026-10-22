import { useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { deleteCoupon, fetchCouponsAdmin, saveCoupon, type Coupon, type CouponInput } from "@/services/coupons";
import { friendlyError } from "@/lib/supabase";

type Row = Coupon & { used: number };

const EMPTY: CouponInput = {
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  max_discount: null,
  min_order: 0,
  usage_limit: null,
  per_user_limit: 1,
  starts_at: null,
  expires_at: null,
  active: true,
};

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function AdminCouponsPage() {
  const { show } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<CouponInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRows(await fetchCouponsAdmin());
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  function startEdit(c: Row | null) {
    if (c) {
      const { id, created_at, used, ...rest } = c;
      void id; void created_at; void used;
      setForm(rest);
      setEditing(c.id);
    } else {
      setForm(EMPTY);
      setEditing("new");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) return show("Enter a coupon code.", "error");
    if (!(form.discount_value > 0)) return show("Discount must be more than 0.", "error");
    if (form.discount_type === "percent" && form.discount_value > 100) return show("Percent cannot be more than 100.", "error");
    setSaving(true);
    try {
      await saveCoupon(editing === "new" ? null : editing, form);
      show("Coupon saved", "success");
      setEditing(null);
      await load();
    } catch (err) {
      show(friendlyError(err, "Could not save the coupon."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Row) {
    try {
      const { id, created_at, used, ...rest } = c;
      void id; void created_at; void used;
      await saveCoupon(c.id, { ...rest, active: !c.active });
      await load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  async function handleDelete(c: Row) {
    if (!confirm(`Delete coupon ${c.code}? Its usage count is lost too. To just stop it, use "Switch off" instead.`)) return;
    try {
      await deleteCoupon(c.id);
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : friendlyError(err), "error");
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!rows) return <LoadingState />;

  const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none";
  const label = "mb-1 block text-xs font-medium text-stone-600";

  return (
    <div className="max-w-4xl">
      <SEO title="Coupons" canonicalPath="/admin/coupons" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-stone-900">Coupons</h1>
        {!editing && (
          <button onClick={() => startEdit(null)} className="rounded-full bg-rose-900 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">
            + New coupon
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={handleSave} className="mb-8 grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
          <div>
            <label className={label}>Code (customers type this)</label>
            <input className={`${input} uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })} maxLength={30} placeholder="DIWALI10" />
          </div>
          <div>
            <label className={label}>Note (only you see this)</label>
            <input className={input} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className={label}>Type</label>
            <select className={input} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percent" | "flat" })}>
              <option value="percent">Percent off (%)</option>
              <option value="flat">Flat amount off (Rs.)</option>
            </select>
          </div>
          <div>
            <label className={label}>{form.discount_type === "percent" ? "Percent (1–100)" : "Amount in Rs."}</label>
            <input type="number" min={1} step="any" className={input} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
          </div>
          {form.discount_type === "percent" && (
            <div>
              <label className={label}>Maximum discount in Rs. (optional)</label>
              <input type="number" min={1} className={input} value={form.max_discount ?? ""} onChange={(e) => setForm({ ...form, max_discount: numOrNull(e.target.value) })} />
            </div>
          )}
          <div>
            <label className={label}>Minimum cart value in Rs.</label>
            <input type="number" min={0} className={input} value={form.min_order} onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label className={label}>Total uses allowed (empty = unlimited)</label>
            <input type="number" min={1} className={input} value={form.usage_limit ?? ""} onChange={(e) => setForm({ ...form, usage_limit: numOrNull(e.target.value) })} />
          </div>
          <div>
            <label className={label}>Uses per customer</label>
            <input type="number" min={1} className={input} value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
          <div>
            <label className={label}>Starts (optional)</label>
            <input type="datetime-local" className={input} value={toLocal(form.starts_at)} onChange={(e) => setForm({ ...form, starts_at: fromLocal(e.target.value) })} />
          </div>
          <div>
            <label className={label}>Expires (optional)</label>
            <input type="datetime-local" className={input} value={toLocal(form.expires_at)} onChange={(e) => setForm({ ...form, expires_at: fromLocal(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save coupon"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-stone-300 px-5 py-2 text-sm text-stone-600">
              Cancel
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 p-6 text-sm text-stone-500">No coupons yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Discount</th>
                <th className="px-4 py-2">Min cart</th>
                <th className="px-4 py-2">Used</th>
                <th className="px-4 py-2">Valid till</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const expired = !!c.expires_at && new Date(c.expires_at) < new Date();
                return (
                  <tr key={c.id} className="border-t border-stone-100">
                    <td className="px-4 py-2 font-semibold text-stone-900">
                      {c.code}
                      {!c.active && <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">OFF</span>}
                      {expired && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">EXPIRED</span>}
                    </td>
                    <td className="px-4 py-2">
                      {c.discount_type === "percent" ? `${c.discount_value}%${c.max_discount ? ` (max ₹${c.max_discount})` : ""}` : `₹${c.discount_value}`}
                    </td>
                    <td className="px-4 py-2">₹{c.min_order}</td>
                    <td className="px-4 py-2">
                      {c.used}
                      {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                    </td>
                    <td className="px-4 py-2 text-xs text-stone-500">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-IN") : "No expiry"}</td>
                    <td className="space-x-3 whitespace-nowrap px-4 py-2 text-right text-xs">
                      <button onClick={() => startEdit(c)} className="text-rose-900 hover:underline">Edit</button>
                      <button onClick={() => toggleActive(c)} className="text-stone-600 hover:underline">{c.active ? "Switch off" : "Switch on"}</button>
                      <button onClick={() => handleDelete(c)} className="text-rose-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
