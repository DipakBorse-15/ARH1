import { useEffect, useState } from "react";
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
export function UpiPaymentCard({ order }: { order: Order }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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

  if (order.payment_method !== "upi" || order.payment_status === "paid") return null;

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

      <p className="mt-3 text-[11px] text-stone-400">
        Already paid? No action needed — we'll update your order status shortly after we verify it.
      </p>
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
