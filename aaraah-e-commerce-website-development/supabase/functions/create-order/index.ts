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
  payment_method: "cod" | "razorpay" | "cashfree" | "phonepe";
}

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

    const total = subtotal + SHIPPING_FEE;

    const { data: orderNumberData } = await admin.rpc("generate_order_number");
    const orderNumber = orderNumberData as string;

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
        payment_status: payload.payment_method === "cod" ? "pending" : "pending",
        status: "pending",
        subtotal,
        shipping_fee: SHIPPING_FEE,
        total,
      })
      .select()
      .single();

    if (orderError || !order) return json({ error: "Could not create order" }, 500);

    const itemsToInsert = orderItems.map((i) => ({ ...i, order_id: order.id }));
    const { error: itemsError } = await admin.from("order_items").insert(itemsToInsert);
    if (itemsError) return json({ error: "Could not save order items" }, 500);

    // Decrement stock atomically per-variant (never touches other colors).
    for (const item of payload.items) {
      await admin.rpc("decrement_variant_stock", {
        p_variant_id: item.variant_id,
        p_quantity: item.quantity,
      });
    }

    // Clear purchased items from the cart.
    await admin.from("cart_items").delete().eq("user_id", userId).in("variant_id", variantIds);

    return json({ order_id: order.id, order_number: order.order_number, total });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
