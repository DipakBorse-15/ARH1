import { useEffect, useRef, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/contexts/ToastContext";
import { formatINR } from "@/components/product/PriceDisplay";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { getRazorpayPayInfo, razorpayExpiryAt, verifyRazorpayPayment, type RazorpayPayInfo } from "@/services/orders";
import { siteConfig } from "@/config/site";
import type { Order } from "@/types";

/**
 * Online payment (Razorpay) for an order that is waiting for its money. Shown on the "Your order" page right after
 * checkout (the payment window opens by itself once) and again on the order's page in My Account, so a customer who
 * closed the window can pay again until the payment time (30 minutes) is over.
 * The order becomes "paid" on the server (razorpay-payment function); this card only opens the window and asks the
 * server to check the result. Razorpay also tells the server directly (webhook), so even a closed browser is fine.
 */
export function RazorpayPaymentCard({
  order,
  autoOpen,
  prefetchedPay,
  onPaid,
}: {
  order: Order;
  autoOpen?: boolean;
  /** Payment details that came back with the order itself; used once for the automatic opening, so no extra server call is needed. */
  prefetchedPay?: RazorpayPayInfo;
  onPaid?: () => void;
}) {
  const { show } = useToast();
  const { refresh: refreshCart } = useCart();
  const [busy, setBusy] = useState<"" | "opening" | "verifying">("");
  const [note, setNote] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  // After a successful payment the button must never come back (no double payment while we confirm).
  const [paidNow, setPaidNow] = useState(false);
  const autoTried = useRef(false);
  const prefetchedUsed = useRef(false);

  const visible = order.payment_method === "razorpay" && order.payment_status !== "paid" && order.status !== "cancelled";
  const deadline = razorpayExpiryAt(order.created_at);
  const deadlineText = deadline.toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" });
  const timeOver = Date.now() > deadline.getTime();

  async function startPayment() {
    if (busy || paidNow) return;
    setNote(null);
    setBusy("opening");
    try {
      const pre = prefetchedUsed.current ? undefined : prefetchedPay;
      prefetchedUsed.current = true;
      const info = pre?.razorpay_order_id && new Date(pre.expires_at).getTime() > Date.now() ? pre : await getRazorpayPayInfo(order.id);
      // Close the window a minute before the order is cancelled, so nobody pays into a cancelled order.
      const secondsLeft = Math.floor((new Date(info.expires_at).getTime() - Date.now()) / 1000) - 60;
      if (secondsLeft < 30) {
        setNote({ tone: "error", text: "The payment time is almost over. Please place the order again." });
        setBusy("");
        return;
      }
      await openRazorpayCheckout({
        keyId: info.key_id,
        razorpayOrderId: info.razorpay_order_id,
        amount: info.amount,
        orderNumber: order.order_number,
        prefill: { name: order.full_name, email: order.email, mobile: order.mobile },
        timeoutSeconds: secondsLeft,
        onDismiss: () => {
          setBusy((b) => (b === "verifying" ? b : ""));
          setNote((n) => n ?? { tone: "info", text: `Payment not completed. You can pay again until ${deadlineText}.` });
        },
        onFailed: (reason) => setNote({ tone: "error", text: reason }),
        onSuccess: (r) => {
          setPaidNow(true);
          setBusy("verifying");
          setNote(null);
          void confirmOnServer(r);
        },
      });
    } catch (err) {
      setBusy("");
      setNote({ tone: "error", text: (err as Error).message || "Could not start the payment. Please try again." });
    }
  }

  async function confirmOnServer(r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
    try {
      const res = await verifyRazorpayPayment(order.id, r);
      if (res.status === "refunded") {
        show(res.message || "Your payment will be refunded automatically.", "info");
      } else {
        show("Payment received. Thank you!", "success");
      }
    } catch {
      // The money may well have been taken: never ask the customer to pay again. The webhook confirms the order on its own,
      // and this page keeps checking.
      setNote({
        tone: "info",
        text: "We are confirming your payment. Please do not pay again — this page updates by itself in a moment.",
      });
    } finally {
      setBusy("");
      void refreshCart();
      onPaid?.();
    }
  }

  // Open the window once by itself right after checkout.
  useEffect(() => {
    if (!autoOpen || autoTried.current || !visible || timeOver) return;
    autoTried.current = true;
    void startPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, visible]);

  if (!visible) return null;

  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
      <h2 className="mb-1 text-sm font-semibold text-stone-900">Complete your payment</h2>

      {paidNow || busy === "verifying" ? (
        <p className="mt-2 text-sm font-medium text-emerald-800">Payment done. Confirming your order…</p>
      ) : timeOver ? (
        <p className="mt-2 text-sm font-medium text-rose-700">
          The payment time (30 minutes) is over, so this order will be cancelled. Please place the order again.
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs text-stone-500">
            Pay {formatINR(order.total)} securely with UPI, cards, netbanking or wallets. Your order is confirmed the moment the payment is done.
          </p>
          <button
            type="button"
            onClick={() => void startPayment()}
            disabled={busy !== ""}
            className="rounded-full bg-rose-900 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
          >
            {busy === "opening" ? "Opening payment…" : `Pay ${formatINR(order.total)}`}
          </button>
          <p className="mt-3 text-[11px] text-stone-500">
            Please pay by {deadlineText}. Unpaid orders are cancelled automatically after that so the stock can go to other customers.
          </p>
        </>
      )}

      {note && <p className={`mt-3 text-xs ${note.tone === "error" ? "font-medium text-rose-700" : "text-stone-600"}`}>{note.text}</p>}

      <p className="mt-4 text-[11px] text-stone-500">
        Money deducted but the order is not confirmed? Do not pay again. WhatsApp us on{" "}
        <a
          href={`https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(`Hi, I paid for order ${order.order_number} but it is not confirmed.`)}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-rose-900 underline"
        >
          {siteConfig.supportPhone}
        </a>{" "}
        with your order number {order.order_number}.
      </p>
    </div>
  );
}
