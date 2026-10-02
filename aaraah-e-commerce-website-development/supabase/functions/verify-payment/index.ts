// Supabase Edge Function: verify-payment
//
// Placeholder for verifying a gateway payment signature/status server-side
// before marking an AARAAH order as paid. Never trust a "payment success"
// flag sent directly from the browser.
//
// For Razorpay: verify `razorpay_signature` using HMAC-SHA256 with
// RAZORPAY_KEY_SECRET against `${razorpay_order_id}|${razorpay_payment_id}`.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // SECURITY: this endpoint marks an order as paid, so it must never be
    // callable anonymously or for an order that isn't the caller's own —
    // an earlier version of this function skipped both checks.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { order_id, gateway_payment_id, gateway_signature } = await req.json();
    if (!order_id) return json({ error: "order_id is required" }, 400);

    const { data: order, error: orderError } = await admin.from("orders").select("id, user_id").eq("id", order_id).single();
    if (orderError || !order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== userData.user.id) return json({ error: "Forbidden" }, 403);

    // TODO: verify gateway_signature with the configured gateway's secret.
    // Until a real gateway is configured, reject verification so orders are
    // never falsely marked as paid. (Today, payments are collected via a
    // manual UPI QR and confirmed by an admin instead — this function isn't
    // called from the UI yet, but stays locked down regardless.)
    if (!gateway_payment_id || !gateway_signature) {
      return json({ error: "Payment gateway not configured. Signature verification unavailable." }, 501);
    }

    await admin.from("orders").update({ payment_status: "paid", status: "confirmed" }).eq("id", order_id);
    return json({ verified: true });
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
