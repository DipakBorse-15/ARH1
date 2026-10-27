import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { PaymentBadge, StatusBadge, formatWhen, telHref, whatsappHref } from "@/components/admin/orderUi";
import { useToast } from "@/contexts/ToastContext";
import { CancelOrderError, cancelOrder, fetchOrderById, sendShippedEmail, type ShippingInput } from "@/services/orders";
import {
  confirmOrderGuarded,
  markDeliveredGuarded,
  markRefundedGuarded,
  markShippedGuarded,
  saveCourierDetails,
  sendPaymentConfirmedEmail,
  startProcessingGuarded,
} from "@/services/adminOrders";
import { friendlyError } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types";

const FLOW: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];
const AUTO_REFRESH_MS = 30_000;

const card = "rounded-2xl border border-stone-200 bg-white p-4";
const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-rose-900 focus:outline-none disabled:opacity-50";
const primaryBtn =
  "w-full rounded-full bg-rose-900 py-3.5 text-sm font-semibold text-white active:bg-rose-800 disabled:opacity-50";
const secondaryBtn =
  "w-full rounded-full border border-stone-300 bg-white py-3 text-sm font-medium text-stone-700 active:bg-stone-50 disabled:opacity-50";

/** Phone order screen: customer, items, payment, and the next step of the order. */
export default function MobileOrderDetailPage() {
  const { orderId } = useParams();
  const { show } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ship, setShip] = useState<ShippingInput>({ courier_name: "", tracking_number: "", tracking_url: "" });

  // `busyRef` blocks a second tap in the same instant (state would update a moment too late).
  const busyRef = useRef(false);
  const loadedAt = useRef(0);
  const shipDirty = useRef(false);

  const load = useCallback(
    async (silent = false) => {
      if (!orderId) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const o = await fetchOrderById(orderId);
        setOrder(o);
        loadedAt.current = Date.now();
        // Do not overwrite courier details the admin is in the middle of typing.
        if (o && !shipDirty.current) {
          setShip({ courier_name: o.courier_name || "", tracking_number: o.tracking_number || "", tracking_url: o.tracking_url || "" });
        }
      } catch (err) {
        if (!silent) setError(friendlyError(err, "Order load nahi ho paya. Internet check karo."));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    shipDirty.current = false;
    void load();
  }, [load]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && !busyRef.current && Date.now() - loadedAt.current > AUTO_REFRESH_MS) {
        void load(true);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  /** Runs one action at a time. A failure shows a message and the order is reloaded from the server. */
  async function run(name: string, fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      show(err instanceof CancelOrderError ? err.message : friendlyError(err), "error");
      await load(true);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  /** The order was changed by someone else (or another tap) a moment ago. */
  async function movedOn() {
    show("Order ka status abhi badal chuka hai. Taaza data dikha raha hoon.", "info");
    shipDirty.current = false;
    await load(true);
  }

  if (loading) return <LoadingState label="Loading order…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!order) return <ErrorState message="Order nahi mila." />;

  const o = order;
  const isCod = o.payment_method === "cod";
  const paidOrCod = o.payment_status === "paid" || isCod;
  const upiUnpaid = o.payment_method === "upi" && o.payment_status !== "paid";
  const status = o.status;

  // ---------- actions ----------
  function confirmOrder() {
    void run("confirm", async () => {
      if (upiUnpaid && !confirm(`Kya ₹${o.total} tumhare UPI app / bank mein aa chuka hai?\n\nTabhi OK dabao. Payment received mark hoga aur customer ko email jayega.`)) return;
      const ok = await confirmOrderGuarded(o.id, upiUnpaid);
      if (!ok) return movedOn();
      show(upiUnpaid ? "Order confirmed, payment received" : "Order confirmed", "success");
      // UPI: "payment received" mail. COD: "order confirmed" mail.
      if (upiUnpaid || isCod) {
        const sent = await sendPaymentConfirmedEmail(o.id);
        if (!sent) show("Order update ho gaya, par customer ko email nahi ja paya.", "error");
      }
      await load(true);
    });
  }

  function startProcessing() {
    void run("process", async () => {
      const ok = await startProcessingGuarded(o.id);
      if (!ok) return movedOn();
      show("Processing shuru", "success");
      await load(true);
    });
  }

  function shipOrder() {
    if (!paidOrCod) return show("Payment abhi confirm nahi hua. Pehle order confirm karo.", "error");
    if (!ship.courier_name.trim()) return show("Courier ka naam daalo (jaise India Post, Delhivery).", "error");
    const url = ship.tracking_url.trim();
    if (url && !/^https?:\/\//i.test(url)) return show("Tracking link http:// ya https:// se shuru hona chahiye.", "error");
    void run("ship", async () => {
      const ok = await markShippedGuarded(o.id, ship);
      if (!ok) return movedOn();
      shipDirty.current = false;
      show("Shipped mark ho gaya", "success");
      const sent = await sendShippedEmail(o.id);
      if (!sent) show("Shipped ho gaya, par customer ko email nahi ja paya. 'Save & email again' dabao.", "error");
      await load(true);
    });
  }

  function saveCourier(andEmail: boolean) {
    const url = ship.tracking_url.trim();
    if (url && !/^https?:\/\//i.test(url)) return show("Tracking link http:// ya https:// se shuru hona chahiye.", "error");
    void run(andEmail ? "courier-email" : "courier-save", async () => {
      await saveCourierDetails(o.id, ship);
      shipDirty.current = false;
      if (!andEmail) {
        show("Courier details save ho gayi", "success");
      } else {
        const sent = await sendShippedEmail(o.id);
        show(sent ? "Saved, tracking email bhej diya" : "Saved, par email nahi ja paya", sent ? "success" : "error");
      }
      await load(true);
    });
  }

  function markDelivered() {
    void run("deliver", async () => {
      if (!paidOrCod) return show("Payment confirm nahi hai, delivered mark nahi ho sakta.", "error");
      if (!confirm("Order deliver ho gaya? Customer ko review-request email jayega.")) return;
      const ok = await markDeliveredGuarded(o.id);
      if (!ok) return movedOn();
      show("Delivered mark ho gaya", "success");
      const sent = await sendShippedEmail(o.id, "delivered");
      if (!sent) show("Delivered ho gaya, par review-request email nahi ja paya.", "error");
      await load(true);
    });
  }

  function cancelThisOrder() {
    void run("cancel", async () => {
      if (!confirm("Order cancel karna hai?\n\nStock wapas aa jayega aur customer ko cancel email jayega. Ye wapas nahi ho sakta.")) return;
      const res = await cancelOrder(o.id);
      show(
        res.emailed ? "Order cancel, stock wapas aur customer ko email gaya" : "Order cancel aur stock wapas, par email nahi ja paya",
        res.emailed ? "success" : "error"
      );
      await load(true);
    });
  }

  function markRefunded() {
    void run("refund", async () => {
      const extra =
        status === "cancelled"
          ? ""
          : "\n\nDhyan do: return aaya maal ka stock apne aap nahi badhega. Products mein stock khud badhao.";
      if (!confirm(`Customer ko ₹${o.total} wapas de diya?\n\nPayment 'refunded' mark ho jayegi.${extra}`)) return;
      const ok = await markRefundedGuarded(o.id);
      if (!ok) return movedOn();
      show("Payment refunded mark ho gayi", "success");
      await load(true);
    });
  }

  async function copyAddress() {
    const text = `${o.full_name}\n${o.mobile}\n${o.address_line1}${o.address_line2 ? `, ${o.address_line2}` : ""}\n${o.city}, ${o.state} ${o.pincode}`;
    try {
      await navigator.clipboard.writeText(text);
      show("Address copy ho gaya", "success");
    } catch {
      show("Copy nahi ho paya", "error");
    }
  }

  const canShip = status === "confirmed" || status === "processing";
  const showShipCard = canShip || status === "shipped" || status === "delivered";
  const canCancel = status === "pending" || status === "confirmed" || status === "processing";
  const canRefund = o.payment_status === "paid" && (status === "cancelled" || status === "shipped" || status === "delivered");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <SEO title={`Order ${o.order_number}`} canonicalPath={`/admin/orders/${o.id}`} />

      <Link to="/admin/orders" className="inline-block py-1 text-sm font-medium text-rose-900">
        ← All orders
      </Link>

      {/* ---------- Header ---------- */}
      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all text-base font-semibold text-stone-900">{o.order_number}</p>
            <p className="text-xs text-stone-500">{formatWhen(o.created_at)}</p>
          </div>
          <p className="shrink-0 text-lg font-semibold text-stone-900">{formatINR(Number(o.total))}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusBadge status={status} />
          <PaymentBadge status={o.payment_status} method={o.payment_method} />
        </div>
        {status !== "cancelled" && (
          <ol className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            {FLOW.map((s) => {
              const here = FLOW.indexOf(status);
              const idx = FLOW.indexOf(s);
              return (
                <li
                  key={s}
                  className={`rounded-full px-2.5 py-1 font-medium capitalize ${
                    s === status ? "bg-rose-900 text-white" : idx < here ? "bg-stone-100 text-stone-400 line-through" : "border border-stone-300 text-stone-500"
                  }`}
                >
                  {s}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* ---------- Next step ---------- */}
      {(status === "pending" || status === "confirmed" || status === "processing" || status === "shipped") && (
        <div className={card}>
          <h2 className="mb-1 text-sm font-semibold text-stone-900">Next step</h2>

          {status === "pending" && (
            <>
              <p className="mb-3 text-xs text-stone-500">
                {upiUnpaid
                  ? o.payment_reference
                    ? `Customer ne UTR bheja hai: ${o.payment_reference}. Apna UPI app / bank check karo, paisa aaya ho tabhi confirm karo.`
                    : "Customer ne abhi UTR nahi bheja. Paisa aa gaya ho tabhi confirm karo."
                  : "COD order. Confirm karne par customer ko email jayega."}
              </p>
              <button type="button" disabled={!!busy} onClick={confirmOrder} className={primaryBtn}>
                {busy === "confirm" ? "Confirming…" : upiUnpaid ? "Payment received · Confirm order" : "Confirm order"}
              </button>
            </>
          )}

          {status === "confirmed" && (
            <>
              <p className="mb-3 text-xs text-stone-500">Packing shuru karo, ya seedha ship karo (niche courier details).</p>
              <button type="button" disabled={!!busy} onClick={startProcessing} className={primaryBtn}>
                {busy === "process" ? "Saving…" : "Start processing"}
              </button>
            </>
          )}

          {status === "processing" && (
            <p className="text-xs text-stone-500">Packing ho gayi? Niche courier details bharke ship karo.</p>
          )}

          {status === "shipped" && (
            <>
              <p className="mb-3 text-xs text-stone-500">Customer ko maal mil gaya ho tab delivered mark karo.</p>
              <button type="button" disabled={!!busy} onClick={markDelivered} className={primaryBtn}>
                {busy === "deliver" ? "Saving…" : "Mark delivered"}
              </button>
            </>
          )}
        </div>
      )}

      {(status === "delivered" || status === "cancelled") && (
        <p className="rounded-2xl bg-stone-100 px-4 py-3 text-xs text-stone-600">
          Ye order {status} hai. Ab iska status nahi badal sakta.
          {status === "cancelled" && o.payment_method === "upi" && o.payment_reference && o.payment_status !== "paid" && (
            <b className="mt-1 block text-rose-700">Customer ne UTR {o.payment_reference} bheja tha. Apna UPI app check karo.</b>
          )}
        </p>
      )}

      {/* ---------- Shipping / tracking ---------- */}
      {showShipCard && (
        <div className={card}>
          <h2 className="mb-3 text-sm font-semibold text-stone-900">Courier &amp; tracking</h2>
          <div className="space-y-3">
            <input
              value={ship.courier_name}
              onChange={(e) => {
                shipDirty.current = true;
                setShip({ ...ship, courier_name: e.target.value });
              }}
              placeholder="Courier (e.g. Delhivery)"
              aria-label="Courier name"
              maxLength={60}
              disabled={!!busy}
              className={inputClass}
            />
            <input
              value={ship.tracking_number}
              onChange={(e) => {
                shipDirty.current = true;
                setShip({ ...ship, tracking_number: e.target.value });
              }}
              placeholder="Tracking number"
              aria-label="Tracking number"
              maxLength={60}
              disabled={!!busy}
              className={inputClass}
            />
            <input
              value={ship.tracking_url}
              onChange={(e) => {
                shipDirty.current = true;
                setShip({ ...ship, tracking_url: e.target.value });
              }}
              placeholder="Tracking link (optional, https://…)"
              aria-label="Tracking link"
              inputMode="url"
              maxLength={300}
              disabled={!!busy}
              className={inputClass}
            />
          </div>
          <div className="mt-3 space-y-2">
            {canShip ? (
              <button type="button" disabled={!!busy} onClick={shipOrder} className={primaryBtn}>
                {busy === "ship" ? "Saving…" : "Mark shipped & email customer"}
              </button>
            ) : (
              <>
                <button type="button" disabled={!!busy} onClick={() => saveCourier(true)} className={primaryBtn}>
                  {busy === "courier-email" ? "Saving…" : "Save & email tracking again"}
                </button>
                <button type="button" disabled={!!busy} onClick={() => saveCourier(false)} className={secondaryBtn}>
                  {busy === "courier-save" ? "Saving…" : "Save details only"}
                </button>
              </>
            )}
          </div>
          {o.shipped_at && <p className="mt-2 text-xs text-stone-400">Shipped on {new Date(o.shipped_at).toLocaleString("en-IN")}</p>}
        </div>
      )}

      {/* ---------- Customer ---------- */}
      <div className={card}>
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Customer</h2>
        <p className="break-words text-sm font-medium text-stone-800">{o.full_name}</p>
        <p className="text-sm text-stone-600">{o.mobile}</p>
        <p className="break-all text-sm text-stone-600">{o.email}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={telHref(o.mobile)} className="rounded-full bg-stone-900 py-3 text-center text-sm font-semibold text-white active:bg-stone-700">
            Call
          </a>
          <a
            href={whatsappHref(o.mobile, o.full_name, o.order_number)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-emerald-600 py-3 text-center text-sm font-semibold text-white active:bg-emerald-700"
          >
            WhatsApp
          </a>
        </div>
        <p className="mt-4 break-words text-sm text-stone-700">
          {o.address_line1}
          {o.address_line2 ? `, ${o.address_line2}` : ""}
          <br />
          {o.city}, {o.state} {o.pincode}
        </p>
        <button type="button" onClick={() => void copyAddress()} className={`${secondaryBtn} mt-3`}>
          Copy address
        </button>
      </div>

      {/* ---------- Items ---------- */}
      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Items</h2>
        <div className="space-y-3">
          {o.items?.map((item) => (
            <div key={item.id} className="flex gap-3 text-sm">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded bg-stone-100">
                {item.image_url && <img src={item.image_url} loading="lazy" className="h-full w-full object-cover" alt="" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-stone-800">{item.product_name}</p>
                <p className="break-words text-xs text-stone-500">
                  {item.color} · SKU {item.sku} · Qty {item.quantity}
                </p>
              </div>
              <p className="shrink-0 font-medium text-stone-900">{formatINR(Number(item.line_total))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Payment ---------- */}
      <div className={card}>
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Payment</h2>
        <p className="text-sm text-stone-600">
          {o.payment_method.toUpperCase()} · <span className="capitalize">{o.payment_status}</span>
        </p>
        {isCod && o.payment_status !== "paid" && status !== "cancelled" && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-800">
            COD: delivery par {formatINR(Number(o.total))} lena hai
          </p>
        )}
        {o.payment_method === "upi" && (
          <p className={`mt-2 rounded-lg p-2 text-sm ${o.payment_reference ? "bg-emerald-50 text-emerald-800" : "bg-stone-50 text-stone-500"}`}>
            {o.payment_reference ? (
              <>
                Customer ka UTR: <span className="break-all font-semibold">{o.payment_reference}</span>
                {o.payment_reference_at && <span className="ml-1 text-xs">({formatWhen(o.payment_reference_at)})</span>}
              </>
            ) : (
              "Customer ne abhi UTR nahi bheja."
            )}
          </p>
        )}
        <div className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatINR(Number(o.subtotal))}</span>
          </div>
          {Number(o.discount_amount) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Coupon{o.coupon_code ? ` (${o.coupon_code})` : ""}</span>
              <span>− {formatINR(Number(o.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{formatINR(Number(o.shipping_fee))}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatINR(Number(o.total))}</span>
          </div>
        </div>
      </div>

      {/* ---------- Cancel / refund ---------- */}
      {(canCancel || canRefund) && (
        <div className={`${card} space-y-2`}>
          <h2 className="mb-1 text-sm font-semibold text-stone-900">Cancel / return</h2>
          {canCancel && (
            <button
              type="button"
              disabled={!!busy}
              onClick={cancelThisOrder}
              className="w-full rounded-full border border-rose-300 bg-white py-3 text-sm font-semibold text-rose-700 active:bg-rose-50 disabled:opacity-50"
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel order"}
            </button>
          )}
          {canRefund && (
            <>
              <button type="button" disabled={!!busy} onClick={markRefunded} className={secondaryBtn}>
                {busy === "refund" ? "Saving…" : "Payment refunded (mark)"}
              </button>
              {status !== "cancelled" && (
                <p className="text-xs text-stone-500">Return ke liye: maal wapas aane aur paisa lautane ke baad ye dabao.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
