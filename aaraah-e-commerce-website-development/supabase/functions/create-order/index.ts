// Supabase Edge Function: create-order
//
// Runs server-side (Deno) so pricing, stock and totals are always
// re-verified from the database — the browser is never trusted for money.
//
// Deploy:   supabase functions deploy create-order
// Invoke:   supabase.functions.invoke('create-order', { body: { items, address, payment_method } })
//
// Required secrets (set with `supabase secrets set`):
//   SUPABASE_URL              (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY (auto-provided, never sent to the frontend)

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
  payment_method: "cod" | "upi";
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

const VALID_PAYMENT_METHODS = new Set(["cod", "upi"]);
// Cash on Delivery is switched off for launch. To turn it back on, add "cod" here
// (and set COD_ENABLED = true in src/pages/CheckoutPage.tsx).
const ENABLED_PAYMENT_METHODS = new Set(["upi"]);

const SHIPPING_FEE = 0; // Flat free shipping for now — adjust as needed.
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
      return json({ error: "Cash on Delivery is coming soon. Please pay via UPI." }, 400);
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
    const { data: recentOrders } = await admin
      .from("orders")
      .select("id, order_number, total, coupon_code, payment_reference, full_name, mobile, email, address_line1, address_line2, city, state, pincode, items:order_items(variant_id, quantity)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
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
    // A UPI order of Rs 0 can never be paid (and would only be auto-cancelled), so such a coupon is not accepted.
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
    for (const item of payload.items) {
      const { error: stockError } = await admin.rpc("decrement_variant_stock", {
        p_variant_id: item.variant_id,
        p_quantity: item.quantity,
      });
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

    // Clear purchased items from the cart — but NOT for a "Buy Now" order: that item was never bought from the cart.
    if (!buyNow) {
      await admin.from("cart_items").delete().eq("user_id", userId).in("variant_id", variantIds);
    }

    // Emails never slow down or fail the order: they are sent in the background (Supabase keeps the function
    // alive until they finish). Customer: "Order received" now, then "Payment received" once confirmed
    // (send-payment-confirmed-email), or "Order cancelled" if not paid in time. Replies go to aaraah.in@gmail.com.
    // The shop owner also gets a short "new order" email so night orders are not missed.
    const sendMails = async () => {
      await Promise.allSettled([
        sendOrderReceivedEmail(
          { id: order.id, order_number: order.order_number, full_name: payload.full_name, email: payload.email, payment_method: payload.payment_method },
          orderItems as Record<string, unknown>[],
          total,
          discount,
          appliedCode
        ).catch((e) => console.error("order-received email failed", e)),
        sendAdminNewOrderEmail(
          { id: order.id, order_number: order.order_number, full_name: payload.full_name, mobile: payload.mobile, city: payload.city, state: payload.state },
          orderItems as Record<string, unknown>[],
          total
        ).catch((e) => console.error("admin new-order email failed", e)),
      ]);
    };
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(sendMails());
    else await sendMails();

    return json({ order_id: order.id, order_number: order.order_number, total });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Short "new order" email to the shop owner. Needs RESEND_API_KEY; optional secret ADMIN_NOTIFY_EMAIL (default: aaraah.in@gmail.com).
async function sendAdminNewOrderEmail(
  order: { id: string; order_number: string; full_name: string; mobile: string; city: string; state: string },
  items: Record<string, unknown>[],
  total: number
) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  const to = Deno.env.get("ADMIN_NOTIFY_EMAIL") || "aaraah.in@gmail.com";
  const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";
  const lines = items
    .map((i) => `<li>${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${esc(i.quantity)}</li>`)
    .join("");
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#7a1730">New order — ${esc(order.order_number)}</h2>
      <p><b>₹${esc(total)}</b> · ${esc(order.full_name)} · ${esc(order.mobile)} · ${esc(order.city)}, ${esc(order.state)}</p>
      <ul>${lines}</ul>
      <p>Payment abhi pending hai (UPI). UTR aane ya paisa aane par admin me <b>Confirm</b> karo.</p>
      <p><a href="https://aaraah.in/admin/orders/${esc(order.id)}" style="display:inline-block;background:#7a1730;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open order</a></p>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `New order ${order.order_number} — ₹${total}`, html }),
    signal: AbortSignal.timeout(5000),
  });
}

// Needs RESEND_API_KEY (and RESEND_FROM). Without the key this quietly does nothing.
async function sendOrderReceivedEmail(
  order: { id: string; order_number: string; full_name: string; email: string; payment_method: string },
  items: Record<string, unknown>[],
  total: number,
  discount = 0,
  couponCode: string | null = null
) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !order.email) return;
  const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:4px 0">${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${esc(i.quantity)}</td><td style="padding:4px 0;text-align:right">₹${esc(i.line_total)}</td></tr>`
    )
    .join("");
  const link = `https://aaraah.in/account/orders/${order.id}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#7a1730">We received your order — ${esc(order.order_number)}</h2>
      <p>Hi ${esc(order.full_name)}, thank you for shopping with AARAAH.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>
      ${discount > 0 ? `<p style="color:#047857;margin:0">Coupon ${esc(couponCode)}: −₹${esc(discount)}</p>` : ""}
      <p style="font-weight:bold">Total: ₹${esc(total)}</p>
      ${
        order.payment_method === "cod"
          ? `<p><b>Payment:</b> Cash on delivery — pay ₹${esc(total)} when your order arrives. We will email you when it is confirmed and shipped.</p>`
          : `<p><b>Next step:</b> pay ₹${esc(total)} by UPI using the QR code on your order page, then enter the UTR / transaction number there.
      Orders without payment are cancelled automatically (3 hours in the daytime, 10:00 AM next morning for night orders) so the stock can go to other customers.</p>`
      }
      <p><a href="${link}" style="display:inline-block;background:#7a1730;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open my order</a></p>
      <p style="color:#78716c;font-size:13px">Questions? Reply to this email or WhatsApp us.</p>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, reply_to: "aaraah.in@gmail.com", to: [order.email], subject: `Order received — ${order.order_number}`, html }),
    signal: AbortSignal.timeout(5000),
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}