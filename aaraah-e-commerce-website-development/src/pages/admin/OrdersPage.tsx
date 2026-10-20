import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useToast } from "@/contexts/ToastContext";
import { deleteOrderAdmin, fetchAllOrdersAdmin, resetOrdersAdmin } from "@/services/orders";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError, supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types";

const STATUS_OPTIONS: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const { show } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { user } = useAuth();

  // Delete one order: needs the last 4 characters of its order number.
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [code, setCode] = useState("");
  // Reset everything: needs the word RESET and the admin's password.
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    if (code.trim() !== deleting.order_number.slice(-4)) {
      show("Wrong code. Enter the last 4 characters of the order number.", "error");
      return;
    }
    setBusy(true);
    try {
      await deleteOrderAdmin(deleting.id, code);
      show(`Order ${deleting.order_number} deleted`, "success");
      setDeleting(null);
      setCode("");
      await load();
    } catch (err) {
      show((err as Error).message || friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset() {
    if (resetWord !== "RESET") {
      show("Type RESET (in capital letters) to continue.", "error");
      return;
    }
    if (!user?.email || !resetPassword) {
      show("Enter your admin password.", "error");
      return;
    }
    setBusy(true);
    try {
      // Re-check the password so a forgotten open admin screen can't wipe the orders.
      const { error: pwError } = await supabase.auth.signInWithPassword({ email: user.email, password: resetPassword });
      if (pwError) {
        show("Wrong password.", "error");
        return;
      }
      await resetOrdersAdmin(resetWord);
      show("All orders deleted. Dashboard is back to zero.", "success");
      setResetOpen(false);
      setResetWord("");
      setResetPassword("");
      await load();
    } catch (err) {
      show((err as Error).message || friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setOrders(await fetchAllOrdersAdmin());
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div>
      <SEO title="Manage Orders" canonicalPath="/admin/orders" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold text-stone-900">Orders</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-stone-300 px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Reset all orders
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && filtered.length === 0 && <EmptyState title="No orders found" />}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Date</th>
                <th className="p-3">Total</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-stone-100">
                  <td className="p-3 font-medium text-stone-800">{o.order_number}</td>
                  <td className="p-3 text-stone-500">{o.full_name}</td>
                  <td className="p-3 text-stone-500">{new Date(o.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="p-3 font-medium text-stone-800">{formatINR(o.total)}</td>
                  <td className="p-3 capitalize text-stone-500">{o.payment_status}</td>
                  <td className="p-3 capitalize text-stone-500">{o.status}</td>
                  <td className="p-3">
                    <Link to={`/admin/orders/${o.id}`} className="mr-3 text-rose-900 hover:underline">
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setCode("");
                        setDeleting(o);
                      }}
                      className="text-stone-400 hover:text-rose-700 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-stone-900">Delete order {deleting.order_number}?</h2>
            <p className="mt-2 text-sm text-stone-600">
              This permanently removes the order and it will no longer count in the dashboard. Stock of orders that are not
              cancelled or delivered is added back.
            </p>
            <label className="mt-4 block text-xs font-medium text-stone-500">
              Enter the code: last 4 characters of the order number
            </label>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={4}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} disabled={busy} className="rounded-full border border-stone-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busy || code.trim().length !== 4}
                className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-rose-800">Reset all orders?</h2>
            <p className="mt-2 text-sm text-stone-600">
              Every order will be deleted for good. Total Orders, Pending Orders, Total Sales and Total Customers on the dashboard go
              back to 0. Customer accounts are not deleted. This cannot be undone.
            </p>
            <label className="mt-4 block text-xs font-medium text-stone-500">Type RESET</label>
            <input
              autoFocus
              value={resetWord}
              onChange={(e) => setResetWord(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
            <label className="mt-3 block text-xs font-medium text-stone-500">Your admin password</label>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetOpen(false);
                  setResetWord("");
                  setResetPassword("");
                }}
                disabled={busy}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReset}
                disabled={busy || resetWord !== "RESET" || !resetPassword}
                className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Resetting…" : "Reset everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
