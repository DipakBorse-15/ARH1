// Supabase Edge Function: create-order
//
// Runs server-side (Deno) so pricing, stock and totals are always
// re-verified from the database — the browser is never trusted for money.
//
// Deploy:   supabase functions deploy create-order
// Invoke:   supabase.functions.invoke('create-order', { body: { items, address, payment_method } })
//
// Payment: Razorpay only. This function reserves the stock, saves the order as "pending / payment pending"
// and creates the matching Razorpay order. The customer then pays in the Razorpay window on the order page;
// the `razorpay-payment` function marks the order paid (and sends the mails / phone alert / empties the cart).
// An order that is not paid within 30 minutes is cancelled by the database job (migration 0045), stock goes back.
//
// Required secrets (set with `supabase secrets set`):
//   SUPABASE_URL              (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY (auto-provided, never sent to the frontend)
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET  (Razorpay dashboard -> API keys; test keys first, live keys later)

import { createClient } from "npm:@supabase/supabase-js@2";

interface IncomingItem {
  variant_id: string;
  quantity: number;
}

interface Payload {
  items: IncomingItem[];
  full_name: string;
  mobile: string;
  email: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  payment_method: "cod" | "upi" | "razorpay";
  coupon_code?: string;
  /** "Buy Now" order (not from the cart): the customer's cart must be left untouched. */
  buy_now?: boolean;
}

// Indian mobile rule — SAME as normalizeMobile() in src/lib/validators.ts (keep both in sync).
// 10 digits starting 6-9, optional +91 / 91 / 0 in front. Returns the plain 10 digits or null.
function normalizeMobile(value: unknown): string | null {
  const compact = String(value ?? "").replace(/[\s\-().]/g, "");
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(compact);
  return m ? m[1] : null;
}

const VALID_PAYMENT_METHODS = new Set(["cod", "upi", "razorpay"]);
// Only Razorpay is switched on. The old manual UPI + UTR flow is off (old UPI orders still work in the admin).
// Cash on Delivery is switched off for launch. To turn it back on, add "cod" here
// (and set COD_ENABLED = true in src/pages/CheckoutPage.tsx).
const ENABLED_PAYMENT_METHODS = new Set(["razorpay"]);

const SHIPPING_FEE = 0; // Flat free shipping for now — adjust as needed.

// Order-attempt limits per customer (protects the stock and the payment gateway from someone who keeps creating
// orders and abandoning them). A normal customer never comes near these. Retrying the SAME order within 2 minutes
// is not counted (it gets the same order back).
const MAX_ORDERS_PER_HOUR = 8;
const MAX_ORDERS_PER_DAY = 25;
const MAX_UNPAID_CANCELLED_PER_DAY = 6;
const PAY_MINUTES = 30; // keep the same as PAY_MINUTES in razorpay-payment (and expire_razorpay_orders(30), migration 0045)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client scoped to the caller — used only to identify the user.
    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Not authenticated" }, 401);
    }
    const userId = userData.user.id;

    // Admin client for trusted reads/writes (bypasses RLS intentionally,
    // because we perform our own authorization + validation here).
    const admin = createClient(supabaseUrl, serviceKey);

    const payload = (await req.json()) as Payload;
    if (!payload.items?.length) return json({ error: "Cart is empty" }, 400);
    if (!payload.full_name || !payload.mobile || !payload.email || !payload.address_line1 || !payload.city || !payload.state || !payload.pincode) {
      return json({ error: "Missing required address fields" }, 400);
    }
    if (!VALID_PAYMENT_METHODS.has(payload.payment_method)) {
      return json({ error: "Invalid payment method" }, 400);
    }
    if (!ENABLED_PAYMENT_METHODS.has(payload.payment_method)) {
      return json({ error: "Cash on Delivery is coming soon. Please pay online." }, 400);
    }

    // ---- Input checks (never trust the browser) --------------------------------
    if (!Array.isArray(payload.items) || payload.items.length > 30) return json({ error: "Invalid cart" }, 400);
    const merged = new Map<string, number>();
    for (const it of payload.items) {
      const qty = Number(it?.quantity);
      if (typeof it?.variant_id !== "string" || !it.variant_id) return json({ error: "Invalid product in cart" }, 400);
      if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
        return json({ error: "Quantity must be a whole number between 1 and 20" }, 400);
      }
      merged.set(it.variant_id, (merged.get(it.variant_id) ?? 0) + qty);
    }
    payload.items = Array.from(merged, ([variant_id, quantity]) => ({ variant_id, quantity }));
    if (payload.items.some((i) => i.quantity > 20)) return json({ error: "Quantity must be between 1 and 20" }, 400);

    const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    payload.full_name = clean(payload.full_name, 100);
    payload.mobile = clean(payload.mobile, 20);
    payload.email = clean(payload.email, 150);
    payload.address_line1 = clean(payload.address_line1, 200);
    payload.address_line2 = clean(payload.address_line2, 200);
    payload.city = clean(payload.city, 80);
    payload.state = clean(payload.state, 80);
    payload.pincode = clean(payload.pincode, 6);
    const couponCode = clean(payload.coupon_code, 30).toUpperCase();
    if (!payload.full_name || !payload.address_line1 || !payload.city || !payload.state) {
      return json({ error: "Missing required address fields" }, 400);
    }
    const cleanMobile = normalizeMobile(payload.mobile);
    if (!cleanMobile) return json({ error: "Enter a valid 10-digit mobile number" }, 400);
    payload.mobile = cleanMobile; // stored as plain 10 digits (no +91 / 0)
    const buyNow = payload.buy_now === true;
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) return json({ error: "Enter a valid email address" }, 400);
    if (!/^\d{6}$/.test(payload.pincode)) return json({ error: "Enter a valid 6-digit pincode" }, 400);

    // ---- Double-click / retry protection ---------------------------------------
    // If this same customer already placed an identical, still-pending order in the
    // last 2 minutes, hand that order back instead of creating (and charging stock for) a second one.
    // If the delivery details are different this time (the customer saw a wrong address and
    // came back to fix it), the same pending order is updated with the new details — the stock it
    // already holds is reused, so a one-piece saree does not become "sold out" for its own buyer.
    const itemKey = (rows: { variant_id: string | null; quantity: number }[]) =>
      rows.map((r) => `${r.variant_id}:${r.quantity}`).sort().join("|");
    const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const detailsKey = (d: { full_name: unknown; mobile: unknown; email: unknown; address_line1: unknown; address_line2: unknown; city: unknown; state: unknown; pincode: unknown }) =>
      [d.full_name, normalizeMobile(d.mobile) ?? d.mobile, d.email, d.address_line1, d.address_line2, d.city, d.state, d.pincode].map(norm).join("|");
    const wantedKey = itemKey(payload.items);
    const wantedDetails = detailsKey({ ...payload, address_line2: payload.address_line2 ?? "" });
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    // Two independent reads at the same time (saves one round trip).
    const [{ data: recentOrders }, attemptsRes] = await Promise.all([
      admin
      .from("orders")
      .select("id, order_number, total, coupon_code, payment_reference, full_name, mobile, email, address_line1, address_line2, city, state, pincode, items:order_items(variant_id, quantity)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5),
      admin
        .from("orders")
        .select("created_at, status, payment_status")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(200),
    ]);
    type RecentOrder = {
      id: string;
      order_number: string;
      total: number;
      coupon_code: string | null;
      payment_reference: string | null;
      full_name: string;
      mobile: string;
      email: string;
      address_line1: string;
      address_line2: string | null;
      city: string;
      state: string;
      pincode: string;
      items: { variant_id: string | null; quantity: number }[];
    };
    const duplicate = ((recentOrders || []) as RecentOrder[]).find(
      (o) => itemKey(o.items || []) === wantedKey && (o.coupon_code || "") === couponCode
    );
    if (duplicate) {
      if (detailsKey(duplicate) === wantedDetails) {
        return json({ order_id: duplicate.id, order_number: duplicate.order_number, total: duplicate.total });
      }
      if (duplicate.payment_reference) {
        return json(
          { error: `Your order ${duplicate.order_number} is already waiting for payment verification, so the address cannot be changed here. Please contact us on WhatsApp.` },
          409
        );
      }
      const { data: updated, error: updateError } = await admin
        .from("orders")
        .update({
          full_name: payload.full_name,
          mobile: payload.mobile,
          email: payload.email,
          address_line1: payload.address_line1,
          address_line2: payload.address_line2 || null,
          city: payload.city,
          state: payload.state,
          pincode: payload.pincode,
        })
        .eq("id", duplicate.id)
        .eq("status", "pending")
        .is("payment_reference", null)
        .select("id");
      if (updateError) return json({ error: "Could not update your order. Please try again." }, 500);
      if (updated && updated.length > 0) {
        return json({ order_id: duplicate.id, order_number: duplicate.order_number, total: duplicate.total });
      }
      // The order moved on (cancelled / paid) in the meantime: fall through and treat this as a fresh order.
    }

    // ---- Too many attempts? (one small read; if it fails the customer is NOT blocked) ----------------------
    {
      const hourAgoMs = Date.now() - 60 * 60 * 1000;
      const { data: attempts, error: attemptsError } = attemptsRes;
      if (!attemptsError && attempts) {
        const lastHour = attempts.filter((r: { created_at: string }) => new Date(r.created_at).getTime() >= hourAgoMs).length;
        const unpaidCancelled = attempts.filter(
          (r: { status: string; payment_status: string }) => r.status === "cancelled" && r.payment_status !== "paid"
        ).length;
        if (lastHour >= MAX_ORDERS_PER_HOUR || attempts.length >= MAX_ORDERS_PER_DAY || unpaidCancelled >= MAX_UNPAID_CANCELLED_PER_DAY) {
          return json(
            { error: "Too many order attempts in a short time. Please wait a while and try again, or contact us on WhatsApp." },
            429
          );
        }
      }
    }

    // A customer keeps at most ONE unpaid online order: an older one they left without paying (closed the payment
    // window, then changed the cart) is cancelled first, so its stock is free again and a one-piece saree does not
    // look "sold out" to its own buyer. If that old payment still arrives later, razorpay-payment re-opens it
    // (stock permitting) or refunds it automatically.
    await admin
      .from("orders")
      .update({ status: "cancelled", cancel_reason: "abandoned" })
      .eq("user_id", userId)
      .eq("payment_method", "razorpay")
      .eq("status", "pending")
      .eq("payment_status", "pending");

    const variantIds = payload.items.map((i) => i.variant_id);
    const { data: variants, error: variantError } = await admin
      .from("product_variants")
      .select("id, sku, color, price, sale_price, stock_quantity, is_available, active, product_id, products(name, brand, active, category_id), product_images(url, sort_order)")
      .in("id", variantIds);

    if (variantError) return json({ error: "Could not verify products" }, 500);

    // Which categories are switched off? (Separate small read — no nested join to go wrong.)
    const productOf = (v: { products?: unknown }) =>
      (Array.isArray(v.products) ? v.products[0] : v.products) as { name?: string; brand?: string; active?: boolean; category_id?: string | null } | undefined;
    const categoryIds = [...new Set((variants || []).map((v: { products?: unknown }) => productOf(v)?.category_id).filter((x): x is string => !!x))];
    const inactiveCategories = new Set<string>();
    if (categoryIds.length) {
      const { data: cats, error: catError } = await admin.from("categories").select("id, active").in("id", categoryIds);
      if (catError) return json({ error: "Could not verify products" }, 500);
      for (const c of (cats || []) as { id: string; active: boolean }[]) if (c.active === false) inactiveCategories.add(c.id);
    }

    const orderItems: Record<string, unknown>[] = [];
    let subtotal = 0;

    for (const item of payload.items) {
      const variant = variants?.find((v: { id: string }) => v.id === item.variant_id);
      if (!variant) return json({ error: "An item in your cart is no longer available. Please refresh your cart and try again." }, 400);

      const product = productOf(variant);
      const label = `${product?.name ?? variant.sku}${variant.color ? ` (${variant.color})` : ""}`;
      // Sellable only when the colour, its design (parent product) AND its category are switched on.
      // A design with no category at all is still sellable.
      const parentOff = product?.active === false || (!!product?.category_id && inactiveCategories.has(product.category_id));
      if (!variant.active || !variant.is_available || parentOff) {
        return json({ error: `${label} is currently unavailable. Please remove it from your cart.` }, 400);
      }
      if (item.quantity < 1) return json({ error: "Invalid quantity" }, 400);
      if (variant.stock_quantity < item.quantity) {
        return json(
          { error: `Not enough stock for ${label}${variant.stock_quantity > 0 ? ` — only ${variant.stock_quantity} left` : ""}. Please update your cart.` },
          409
        );
      }

      const unitPrice = Number(variant.sale_price ?? variant.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return json({ error: `${label} is currently unavailable. Please remove it from your cart.` }, 400);
      }
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      const images = (variant.product_images || []).sort(
        (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
      );

      orderItems.push({
        variant_id: variant.id,
        product_name: product?.name ?? "Product",
        brand: product?.brand ?? "AARAAH",
        color: variant.color,
        sku: variant.sku,
        quantity: item.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        image_url: images[0]?.url ?? null,
      });
    }

    // ---- Coupon (re-checked here; the checkout page's preview is not trusted) ----
    let couponId: string | null = null;
    let appliedCode: string | null = null;
    let discount = 0;
    if (couponCode) {
      const { data: c, error: couponError } = await admin.rpc("compute_coupon", {
        p_code: couponCode,
        p_user: userId,
        p_subtotal: subtotal,
      });
      if (couponError) return json({ error: couponError.message || "This coupon cannot be used" }, 400);
      const row = Array.isArray(c) ? c[0] : c;
      if (!row) return json({ error: "This coupon cannot be used" }, 400);
      couponId = row.coupon_id;
      appliedCode = row.code;
      discount = Math.min(Number(row.discount) || 0, subtotal);
    }

    const total = subtotal - discount + SHIPPING_FEE;
    // An online order of Rs 0 can never be paid (and would only be auto-cancelled), so such a coupon is not accepted.
    if (total < 1) {
      return json({ error: "This coupon would make the whole order free. Please add more items or use a smaller coupon." }, 400);
    }

    const { data: orderNumberData } = await admin.rpc("generate_order_number");
    const orderNumber = orderNumberData as string;
    if (!orderNumber) return json({ error: "Could not create order. Please try again." }, 500);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: userId,
        full_name: payload.full_name,
        mobile: payload.mobile,
        email: payload.email,
        address_line1: payload.address_line1,
        address_line2: payload.address_line2 ?? null,
        city: payload.city,
        state: payload.state,
        pincode: payload.pincode,
        payment_method: payload.payment_method,
        payment_status: "pending",
        status: "pending",
        subtotal,
        shipping_fee: SHIPPING_FEE,
        coupon_code: appliedCode,
        discount_amount: discount,
        total,
        buy_now: buyNow,
      })
      .select()
      .single();

    if (orderError || !order) return json({ error: "Could not create order" }, 500);

    const itemsToInsert = orderItems.map((i) => ({ ...i, order_id: order.id }));
    const { error: itemsError } = await admin.from("order_items").insert(itemsToInsert);
    if (itemsError) {
      // Don't leave an empty order behind.
      await admin.from("orders").delete().eq("id", order.id);
      return json({ error: "Could not save your order. Please try again." }, 500);
    }

    // Record the coupon use. A cancelled/expired order stops counting automatically.
    if (couponId) {
      const { error: redeemError } = await admin
        .from("coupon_redemptions")
        .insert({ coupon_id: couponId, order_id: order.id, user_id: userId });
      if (redeemError) {
        await admin.from("orders").delete().eq("id", order.id);
        return json({ error: "Could not apply the coupon. Please try again." }, 500);
      }

      // Two customers can press "Place order" in the same second and both pass the limit check above.
      // Count again now that this order's use is saved; if a limit is exceeded, drop this order (no stock is reserved yet).
      const cid = couponId;
      const { data: limits } = await admin.from("coupons").select("usage_limit, per_user_limit").eq("id", cid).maybeSingle();
      const countUses = async (onlyThisUser: boolean): Promise<number | null> => {
        let q = admin
          .from("coupon_redemptions")
          .select("id, orders!inner(status)", { count: "exact", head: true })
          .eq("coupon_id", cid)
          .neq("orders.status", "cancelled");
        if (onlyThisUser) q = q.eq("user_id", userId);
        const { count, error: countError } = await q;
        return countError ? null : count ?? 0;
      };
      const totalUses = limits?.usage_limit != null ? await countUses(false) : null;
      const userUses = limits?.per_user_limit != null ? await countUses(true) : null;
      const overTotal = totalUses !== null && limits?.usage_limit != null && totalUses > limits.usage_limit;
      const overUser = userUses !== null && limits?.per_user_limit != null && userUses > limits.per_user_limit;
      if (overTotal || overUser) {
        await admin.from("orders").delete().eq("id", order.id);
        return json({ error: "This coupon has just been used up. Please place your order again without it." }, 409);
      }
    }

    // Decrement stock atomically per-variant (never touches other colors).
    // decrement_variant_stock raises an exception (and the `.error` below is
    // set) if a concurrent order already took the remaining stock.
    const outOfStockSkus: string[] = [];
    const failedVariantIds: string[] = [];
    // Every colour is its own row and each call is atomic, so all of them can run at the same time.
    const stockResults = await Promise.all(
      payload.items.map(async (item) => ({
        item,
        stockError: (
          await admin.rpc("decrement_variant_stock", {
            p_variant_id: item.variant_id,
            p_quantity: item.quantity,
          })
        ).error,
      }))
    );
    for (const { item, stockError } of stockResults) {
      if (stockError) {
        const variant = variants?.find((v: { id: string }) => v.id === item.variant_id);
        outOfStockSkus.push(variant?.sku ?? item.variant_id);
        failedVariantIds.push(item.variant_id);
      }
    }

    if (outOfStockSkus.length > 0) {
      // Don't leave a "successful" order whose stock was never actually
      // reserved — cancel it and tell the customer which items to revisit.
      // Cancelling an order makes a database trigger put back the stock of
      // EVERY item still on it, so first drop the items that never got their
      // stock reserved; the items that did decrement are then restored
      // automatically and nothing is left over.
      await admin.from("order_items").delete().eq("order_id", order.id).in("variant_id", failedVariantIds);
      await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return json(
        { error: `Sorry, these items just sold out: ${outOfStockSkus.join(", ")}. Please update your cart and try again.` },
        409
      );
    }

    // Create the matching Razorpay order (the payment window needs it). If Razorpay cannot be reached the order is
    // cancelled right away (the stock trigger puts the stock back) and the customer can simply try again.
    let razorpayOrderId: string;
    try {
      razorpayOrderId = await createRazorpayOrder(order.id, order.order_number, total);
    } catch (e) {
      console.error("razorpay order failed", e);
      await admin.from("orders").update({ status: "cancelled", cancel_reason: "abandoned" }).eq("id", order.id);
      return json({ error: "Online payment is not available right now. Please try again in a few minutes." }, 400);
    }
    const { error: linkError } = await admin.from("orders").update({ razorpay_order_id: razorpayOrderId }).eq("id", order.id);
    if (linkError) {
      console.error(linkError);
      await admin.from("orders").update({ status: "cancelled", cancel_reason: "abandoned" }).eq("id", order.id);
      return json({ error: "Could not start the payment. Please try again." }, 500);
    }

    // No mail, phone alert or cart change here: all of that happens when the money really arrives
    // (razorpay-payment function). An order that is never paid is cancelled after 30 minutes without disturbing anyone.
    // The payment window needs these; sending them now saves the order page a second server call.
    const payInfo = {
      key_id: Deno.env.get("RAZORPAY_KEY_ID"),
      razorpay_order_id: razorpayOrderId,
      amount: Math.round(total * 100),
      currency: "INR",
      expires_at: new Date(new Date(order.created_at).getTime() + PAY_MINUTES * 60_000).toISOString(),
    };
    return json({ order_id: order.id, order_number: order.order_number, total, pay: payInfo });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

// Razorpay Orders API: amount is in paise. `receipt` = our order number (max 40 characters).
async function createRazorpayOrder(orderId: string, orderNumber: string, totalRupees: number): Promise<string> {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET secrets are not set");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(totalRupees * 100),
      currency: "INR",
      receipt: orderNumber,
      notes: { order_id: orderId, order_number: orderNumber },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.id !== "string") throw new Error(`Razorpay ${res.status}: ${data?.error?.description ?? "no order id"}`);
  return data.id;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}