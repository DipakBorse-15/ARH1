import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { formatINR } from "@/components/product/PriceDisplay";
import { effectivePrice } from "@/services/products";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/contexts/ToastContext";
import { fetchAddresses, saveAddressIfNew } from "@/services/addresses";
import { placeOrder } from "@/services/orders";
import { previewCoupon } from "@/services/coupons";
import { siteConfig } from "@/config/site";
import { friendlyError } from "@/lib/supabase";
import type { Address, ProductVariant, ProductWithVariants } from "@/types";

/** Cash on Delivery is switched off for launch. Set to true (and in the create-order Edge Function
 *  ENABLED_PAYMENT_METHODS) to turn it back on. */
const COD_ENABLED = false;

interface DirectItemState {
  variant_id: string;
  quantity: number;
  product: ProductWithVariants;
  variant: ProductVariant;
}

interface FormState {
  full_name: string;
  mobile: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  payment_method: "cod" | "upi";
}

const EMPTY_FORM: FormState = {
  full_name: "",
  mobile: "",
  email: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  payment_method: "upi",
};

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { items: cartItems, subtotal: cartSubtotal, refresh } = useCart();
  const { show } = useToast();

  const directItem = (location.state as { directItem?: DirectItemState } | null)?.directItem;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false); // stops a fast double-tap from sending two orders

  useEffect(() => {
    // Only fill fields the customer hasn't typed yet — a profile refresh
    // (token renewal, tab focus) must never wipe what they are typing.
    const metaMobile = typeof user?.user_metadata?.mobile === "string" ? user.user_metadata.mobile : "";
    setForm((f) => ({
      ...f,
      full_name: f.full_name || profile?.full_name || "",
      email: f.email || profile?.email || user?.email || "",
      mobile: f.mobile || profile?.mobile || metaMobile,
    }));
  }, [user, profile]);

  useEffect(() => {
    if (user) fetchAddresses(user.id).then(setSavedAddresses).catch(() => {});
  }, [user]);

  const lines = useMemo(() => {
    if (directItem) {
      const price = effectivePrice(directItem.variant);
      return [
        {
          variant_id: directItem.variant_id,
          quantity: directItem.quantity,
          name: directItem.product.name,
          color: directItem.variant.color,
          sku: directItem.variant.sku,
          price,
          image: directItem.variant.images?.[0]?.url,
        },
      ];
    }
    return cartItems
      .filter((i) => i.variant)
      .map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
        name: i.variant?.product?.name || "Product",
        color: i.variant?.color || null,
        sku: i.variant?.sku || "",
        price: i.variant ? effectivePrice(i.variant) : 0,
        image: i.variant?.images?.[0]?.url,
      }));
  }, [directItem, cartItems]);

  const subtotal = directItem ? effectivePrice(directItem.variant) * directItem.quantity : cartSubtotal;
  // Must match SHIPPING_FEE in the create-order Edge Function exactly — this
  // number is only ever a preview, the server computes the order's real total.
  const shipping = 0;
  // Coupon: the discount shown here is a preview; the server re-checks the code and sets the real total.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const total = subtotal - discount + shipping;

  // The cart changed after the code was applied: make the customer apply it again.
  useEffect(() => {
    if (coupon) {
      setCoupon(null);
      setCouponMsg("Your cart changed — please apply the coupon again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    setCouponMsg(null);
    try {
      setCoupon(await previewCoupon(couponInput, subtotal));
    } catch (err) {
      setCoupon(null);
      setCouponMsg(err instanceof Error ? err.message : "This coupon cannot be used.");
    } finally {
      setCouponBusy(false);
    }
  }

  function applyAddress(a: Address) {
    setForm((f) => ({
      ...f,
      full_name: a.full_name,
      mobile: a.mobile,
      address_line1: a.line1,
      address_line2: a.line2 || "",
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.full_name.trim()) next.full_name = "Full name is required";
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) next.mobile = "Enter a valid 10-digit mobile number";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address";
    if (!form.address_line1.trim()) next.address_line1 = "Address is required";
    if (!form.city.trim()) next.city = "City is required";
    if (!form.state.trim()) next.state = "State is required";
    if (!/^\d{6}$/.test(form.pincode.trim())) next.pincode = "Enter a valid 6-digit pincode";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }
    if (!lines.length) {
      show("There is nothing to check out.", "error");
      return;
    }
    if (form.payment_method === "cod" && !COD_ENABLED) {
      show("Cash on Delivery is coming soon. Please pay via UPI.", "error");
      return;
    }
    if (!validate()) return;
    if (form.payment_method === "upi" && !siteConfig.upiConfigured) {
      show("Online payment is being set up. Please contact us on WhatsApp to order.", "error");
      return;
    }
    if (submitLock.current) return;
    submitLock.current = true;

    setSubmitting(true);
    try {
      // Best-effort and de-duplicated: never blocks the order, never saves the same address twice.
      await saveAddressIfNew({
        user_id: user.id,
        full_name: form.full_name,
        mobile: form.mobile,
        line1: form.address_line1,
        line2: form.address_line2 || null,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      }).catch(() => {});

      const result = await placeOrder({
        items: lines.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity })),
        full_name: form.full_name,
        mobile: form.mobile,
        email: form.email,
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        payment_method: form.payment_method,
        coupon_code: coupon?.code,
      });

      if (!directItem) await refresh();
      navigate(`/order-confirmation/${result.order_id}`, { state: { orderNumber: result.order_number } });
    } catch (err) {
      show(friendlyError(err, "Could not place your order. Please try again."), "error");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <SEO title="Checkout" canonicalPath="/checkout" />
      <h1 className="mb-6 font-serif text-3xl font-semibold text-stone-900">Checkout</h1>

      {!lines.length ? (
        <p className="text-stone-500">Your cart is empty. Add products before checking out.</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {savedAddresses.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-stone-900">Saved addresses</h2>
                <div className="flex flex-wrap gap-2">
                  {savedAddresses.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => applyAddress(a)}
                      className="rounded-full border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-rose-900"
                    >
                      {a.full_name} — {a.city}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-stone-200 p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-900">Shipping details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" error={errors.full_name}>
                  <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </Field>
                <Field label="Mobile Number" error={errors.mobile}>
                  <input className={inputClass} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </Field>
                <Field label="Email" error={errors.email} full>
                  <input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
                <Field label="Address" error={errors.address_line1} full>
                  <input
                    className={inputClass}
                    value={form.address_line1}
                    onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                  />
                </Field>
                <Field label="Apartment, suite, etc. (optional)" full>
                  <input
                    className={inputClass}
                    value={form.address_line2}
                    onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
                  />
                </Field>
                <Field label="City" error={errors.city}>
                  <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State" error={errors.state}>
                  <input className={inputClass} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
                <Field label="Pincode" error={errors.pincode}>
                  <input className={inputClass} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-900">Payment method</h2>
              <label
                className={`flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm ${
                  COD_ENABLED ? "" : "cursor-not-allowed bg-stone-50 text-stone-400"
                }`}
              >
                <input
                  type="radio"
                  disabled={!COD_ENABLED}
                  checked={COD_ENABLED && form.payment_method === "cod"}
                  onChange={() => setForm({ ...form, payment_method: "cod" })}
                />
                <span>Cash on Delivery</span>
                {!COD_ENABLED && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Coming Soon</span>
                )}
              </label>
              <label className="mt-2 flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm">
                <input
                  type="radio"
                  checked={form.payment_method === "upi"}
                  onChange={() => setForm({ ...form, payment_method: "upi" })}
                />
                Pay via UPI (scan QR after placing order)
              </label>
            </div>
          </div>

          <div className="h-fit rounded-2xl border border-stone-200 p-5">
            <h2 className="mb-4 font-semibold text-stone-900">Order Summary</h2>
            <div className="mb-4 space-y-3">
              {lines.map((l) => (
                <div key={l.variant_id} className="flex gap-3 text-sm">
                  <div className="h-14 w-12 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                    {l.image && <img src={l.image} className="h-full w-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1">
                    <p className="line-clamp-1 text-stone-800">{l.name}</p>
                    <p className="text-xs text-stone-400">
                      {l.color} · Qty {l.quantity}
                    </p>
                  </div>
                  <p className="font-medium text-stone-900">{formatINR(l.price * l.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="mb-4 border-t border-stone-200 pt-3">
              {coupon ? (
                <p className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span>
                    <b>{coupon.code}</b> applied — you save {formatINR(discount)}
                  </span>
                  <button type="button" onClick={() => { setCoupon(null); setCouponInput(""); setCouponMsg(null); }} className="text-xs underline">
                    Remove
                  </button>
                </p>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                      placeholder="Coupon code"
                      maxLength={30}
                      aria-label="Coupon code"
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm uppercase focus:border-rose-900 focus:outline-none"
                    />
                    <button type="button" onClick={applyCoupon} disabled={couponBusy || !couponInput.trim()} className="rounded-lg border border-rose-900 px-4 text-sm font-medium text-rose-900 hover:bg-rose-50 disabled:opacity-40">
                      {couponBusy ? "…" : "Apply"}
                    </button>
                  </div>
                  {couponMsg && <p className="mt-1.5 text-xs text-rose-700">{couponMsg}</p>}
                </div>
              )}
            </div>
            <div className="space-y-2 border-t border-stone-200 pt-3 text-sm text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon ({coupon?.code})</span>
                  <span>− {formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatINR(total)}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
            >
              {submitting ? "Placing order…" : "Place Order"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none";

function Field({
  label,
  error,
  full,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-stone-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
