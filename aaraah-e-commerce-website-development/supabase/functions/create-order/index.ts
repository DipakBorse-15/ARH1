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
    if (!/^\+?[\d\s-]{10,16}$/.test(payload.mobile)) return json({ error: "Enter a valid mobile number" }, 400);
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) return json({ error: "Enter a valid email address" }, 400);
    if (!/^\d{6}$/.test(payload.pincode)) return json({ error: "Enter a valid 6-digit pincode" }, 400);

    // ---- Double-click / retry protection ---------------------------------------
    // If this same customer already placed an identical, still-pending order in the
    // last 2 minutes, hand that order back instead of creating (and charging stock for) a second one.
    const itemKey = (rows: { variant_id: string | null; quantity: number }[]) =>
      rows.map((r) => `${r.variant_id}:${r.quantity}`).sort().join("|");
    const wantedKey = itemKey(payload.items);
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recentOrders } = await admin
      .from("orders")
      .select("id, order_number, total, coupon_code, items:order_items(variant_id, quantity)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const duplicate = (recentOrders || []).find(
      (o: { coupon_code: string | null; items: { variant_id: string | null; quantity: number }[] }) =>
        itemKey(o.items || []) === wantedKey && (o.coupon_code || "") === couponCode
    );
    if (duplicate) {
      return json({ order_id: duplicate.id, order_number: duplicate.order_number, total: duplicate.total });
    }

    const variantIds = payload.items.map((i) => i.variant_id);
    const { data: variants, error: variantError } = await admin
      .from("product_variants")
      .select("id, sku, color, price, sale_price, stock_quantity, is_available, active, product_id, products(name, brand), product_images(url, sort_order)")
      .in("id", variantIds);

    if (variantError) return json({ error: "Could not verify products" }, 500);

    const orderItems: Record<string, unknown>[] = [];
    let subtotal = 0;

    for (const item of payload.items) {
      const variant = variants?.find((v: { id: string }) => v.id === item.variant_id);
      if (!variant) return json({ error: `Product variant not found: ${item.variant_id}` }, 400);
      if (!variant.active || !variant.is_available) {
        return json({ error: `${variant.sku} is currently unavailable` }, 400);
      }
      if (item.quantity < 1) return json({ error: "Invalid quantity" }, 400);
      if (variant.stock_quantity < item.quantity) {
        return json({ error: `Insufficient stock for SKU ${variant.sku}` }, 409);
      }

      const unitPrice = Number(variant.sale_price ?? variant.price);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
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

    // Clear purchased items from the cart.
    await admin.from("cart_items").delete().eq("user_id", userId).in("variant_id", variantIds);

    // No email at placement on purpose: the customer gets the "Payment received" email (send-payment-confirmed-email)
    // once the payment is confirmed, or the "Order cancelled" email if it is not paid within 3 hours.
    // (sendOrderReceivedEmail below is kept but no longer called.)

    return json({ order_id: order.id, order_number: order.order_number, total });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Needs RESEND_API_KEY (and RESEND_FROM). Without the key this quietly does nothing.
async function sendOrderReceivedEmail(
  order: { id: string; order_number: string; full_name: string; email: string },
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
      <p><b>Next step:</b> pay ₹${esc(total)} by UPI using the QR code on your order page, then enter the UTR / transaction number there.
      Orders without payment are cancelled automatically after 3 hours so the stock can go to other customers.</p>
      <p><a href="${link}" style="display:inline-block;background:#7a1730;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open my order</a></p>
      <p style="color:#78716c;font-size:13px">Questions? Reply to this email or WhatsApp us.</p>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [order.email], subject: `Order received — ${order.order_number}`, html }),
    signal: AbortSignal.timeout(5000),
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
