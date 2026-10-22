import { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { UNPAID_HOURS, submitPaymentReference } from "@/services/orders";
import QRCode from "qrcode";
import { siteConfig } from "@/config/site";
import { formatINR } from "@/components/product/PriceDisplay";
import type { Order } from "@/types";

/**
 * Manual UPI collection flow: no payment gateway involved. The customer
 * scans this QR (or taps the link on mobile) and pays directly to our UPI
 * ID; we check our own UPI app / bank and mark the order "paid" by hand
 * from the admin Order Detail page (see updateOrderPaymentStatus).
 */
export function UpiPaymentCard({ order, onSubmitted }: { order: Order; onSubmitted?: () => void }) {
  const { show } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [utr, setUtr] = useState("");
  const [sending, setSending] = useState(false);
  const upiLink = buildUpiLink(order);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(upiLink, { width: 240, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [upiLink]);

  if (order.payment_method !== "upi" || order.payment_status === "paid" || order.status === "cancelled") return null;

  const deadline = new Date(new Date(order.created_at).getTime() + UNPAID_HOURS * 3600 * 1000);
  const deadlineText = deadline.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const timeOver = Date.now() > deadline.getTime();

  async function sendUtr(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await submitPaymentReference(order.id, utr);
      show("Thank you! We'll confirm your payment shortly.", "success");
      setUtr("");
      onSubmitted?.();
    } catch (err) {
      show((err as Error).message || "Could not save the number. Please try again.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
      <h2 className="mb-1 text-sm font-semibold text-stone-900">Pay via UPI to confirm your order</h2>
      <p className="mb-4 text-xs text-stone-500">
        Scan the QR code below with any UPI app (GPay, PhonePe, Paytm) and pay {formatINR(order.total)}. We'll
        confirm your order as soon as the payment is received.
      </p>

      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="UPI QR code"
          className="mx-auto h-56 w-56 rounded-lg border border-stone-200 bg-white p-2"
        />
      ) : (
        <div className="mx-auto h-56 w-56 animate-pulse rounded-lg bg-stone-100" />
      )}

      <p className="mt-3 text-sm text-stone-700">
        UPI ID: <span className="font-semibold">{siteConfig.upiId}</span>
      </p>

      <a
        href={upiLink}
        className="mt-4 inline-block rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white sm:hidden"
      >
        Open in UPI App
      </a>

      {order.payment_reference ? (
        <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Payment number received: <span className="font-semibold">{order.payment_reference}</span>. We'll confirm your order as soon as we see the payment.
        </p>
      ) : (
        <form onSubmit={sendUtr} className="mt-5 text-left">
          <p className="text-xs font-semibold text-stone-800">Paid already? Enter your UTR / transaction number</p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            You will find it in your UPI app under payment details (usually 12 digits). This helps us confirm your order quickly.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. 412345678901"
              maxLength={30}
              inputMode="text"
              className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || utr.trim().length < 8}
              className="rounded-full bg-rose-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {sending ? "Sending…" : "Submit"}
            </button>
          </div>
          <p className={`mt-3 text-[11px] ${timeOver ? "font-medium text-rose-700" : "text-stone-500"}`}>
            {timeOver
              ? `The ${UNPAID_HOURS}-hour payment time is over. If you have already paid, enter your number above right away; otherwise this order may be cancelled.`
              : `Please pay by ${deadlineText}. Orders without payment are cancelled automatically after ${UNPAID_HOURS} hours so the stock can go to other customers.`}
          </p>
        </form>
      )}
    </div>
  );
}

function buildUpiLink(order: Order): string {
  const params = new URLSearchParams({
    pa: siteConfig.upiId,
    pn: siteConfig.upiPayeeName,
    am: order.total.toFixed(2),
    cu: "INR",
    tn: `Order ${order.order_number}`,
  });
  return `upi://pay?${params.toString()}`;
}
