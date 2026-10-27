import type { OrderStatus, PaymentStatus } from "@/types";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-stone-100 text-stone-600",
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  refunded: "bg-stone-200 text-stone-700",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[status] ?? "bg-stone-100 text-stone-600"}`}>
      {status}
    </span>
  );
}

export function PaymentBadge({ status, method }: { status: PaymentStatus; method: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYMENT_STYLE[status] ?? "bg-stone-100 text-stone-600"}`}>
      {method.toUpperCase()} · {status}
    </span>
  );
}

/** "26 Oct, 4:30 pm" */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Digits for wa.me. A bare 10-digit Indian number gets 91 in front. */
export function waNumber(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

export function telHref(mobile: string): string {
  return `tel:+${waNumber(mobile)}`;
}

export function whatsappHref(mobile: string, name: string, orderNumber: string): string {
  const first = name.trim().split(/\s+/)[0] || "";
  const text = `Namaste ${first}, AARAAH se aapke order ${orderNumber} ke baare mein.`;
  return `https://wa.me/${waNumber(mobile)}?text=${encodeURIComponent(text)}`;
}
