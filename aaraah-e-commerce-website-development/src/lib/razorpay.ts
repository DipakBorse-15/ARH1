import { siteConfig } from "@/config/site";

/**
 * Razorpay Standard Checkout, loaded only when a customer is about to pay (no npm package, nothing on other pages).
 * The payment window is Razorpay's own; card / UPI details never touch our server.
 */

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  /** Seconds after which the window closes by itself. */
  timeout?: number;
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
  handler: (response: RazorpaySuccessResponse) => void;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: (r: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let scriptLoading: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoading = null;
      s.remove();
      reject(new Error("Could not open the payment window. Please check your internet connection and try again."));
    };
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export interface OpenCheckoutArgs {
  keyId: string;
  razorpayOrderId: string;
  /** In paise. */
  amount: number;
  orderNumber: string;
  prefill: { name?: string; email?: string; mobile?: string };
  /** Seconds until the window closes by itself (keep it shorter than the order's payment time). */
  timeoutSeconds?: number;
  onSuccess: (r: RazorpaySuccessResponse) => void;
  /** The customer closed the window without paying. */
  onDismiss: () => void;
  /** The bank / UPI app said the payment failed (the customer can retry in the same window). */
  onFailed?: (reason: string) => void;
}

export async function openRazorpayCheckout(a: OpenCheckoutArgs): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Could not open the payment window. Please try again.");
  const contact = a.prefill.mobile && /^[6-9]\d{9}$/.test(a.prefill.mobile) ? `+91${a.prefill.mobile}` : undefined;
  const rzp = new window.Razorpay({
    key: a.keyId,
    amount: a.amount,
    currency: "INR",
    name: siteConfig.name,
    description: `Order ${a.orderNumber}`,
    order_id: a.razorpayOrderId,
    prefill: { name: a.prefill.name, email: a.prefill.email, contact },
    theme: { color: "#7a1730" },
    timeout: a.timeoutSeconds && a.timeoutSeconds > 0 ? Math.floor(a.timeoutSeconds) : undefined,
    modal: { ondismiss: a.onDismiss, confirm_close: true },
    handler: a.onSuccess,
  });
  rzp.on("payment.failed", (r) => a.onFailed?.(r?.error?.description || "The payment failed. Please try again."));
  rzp.open();
}
