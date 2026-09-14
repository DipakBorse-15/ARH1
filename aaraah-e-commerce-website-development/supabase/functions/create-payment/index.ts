// Supabase Edge Function: create-payment
//
// Placeholder for Indian payment gateway integration (Razorpay/Cashfree/PhonePe).
// The frontend never talks to the gateway directly with a secret key — it calls
// this function, which creates a gateway order/session using a server-side
// secret and returns only the public fields required to open the checkout UI.
//
// To go live with Razorpay for example:
//   1. supabase secrets set RAZORPAY_KEY_ID=xxx RAZORPAY_KEY_SECRET=xxx
//   2. Replace the TODO block below with a real `fetch` call to
//      https://api.razorpay.com/v1/orders using Basic auth (key_id:key_secret).
//   3. Return { gateway: 'razorpay', order_id, amount, currency, key_id }.
//   4. Verify the payment signature server-side in verify-payment before
//      marking the AARAAH order as paid.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });

    const { data: userData } = await admin.auth.getUser();
    if (!userData?.user) return json({ error: "Not authenticated" }, 401);

    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id is required" }, 400);

    const { data: order, error } = await admin.from("orders").select("*").eq("id", order_id).single();
    if (error || !order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== userData.user.id) return json({ error: "Forbidden" }, 403);

    // TODO: integrate real gateway order creation here using server secrets.
    // For now this returns a placeholder response so the checkout flow can be
    // wired end-to-end and swapped for a live gateway without touching the UI.
    return json({
      gateway: "not_configured",
      message: "Online payment gateway is not yet configured. Use Cash on Delivery, or configure a gateway secret and implement this function.",
      order_number: order.order_number,
      amount: order.total,
      currency: "INR",
    });
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
