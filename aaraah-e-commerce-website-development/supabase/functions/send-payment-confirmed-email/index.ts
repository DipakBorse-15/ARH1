// Supabase Edge Function: send-payment-confirmed-email
//
// Called from the admin Order Detail page right after an order's payment is
// marked "paid" (currently: the manual-UPI confirm flow). Admin-only — never
// callable by a regular customer, since it would otherwise let anyone spam
// arbitrary email addresses tied to any order_id.
//
// Required secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   — from resend.com/api-keys
//   RESEND_FROM      — optional, e.g. "AARAAH <orders@aaraah.in>".
//                       Defaults to Resend's onboarding@resend.dev, which
//                       Resend only allows sending FROM to your OWN Resend
//                       account email — it cannot reach real customers.
//                       To actually email customers, verify aaraah.in as a
//                       domain in Resend (resend.com/domains) first, then
//                       set RESEND_FROM to an address on that domain.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Admin-only: this sends email on anyone's behalf, so the caller must
    // actually be staff, not just any logged-in customer.
    const { data: profile } = await admin.from("profiles").select("role").eq("user_id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id is required" }, 400);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("id", order_id)
      .single();
    if (orderError || !order) return json({ error: "Order not found" }, 404);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured" }, 501);
    const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";

    const itemRows = (order.items || [])
      .map(
        (i: { product_name: string; color: string | null; quantity: number; line_total: number }) =>
          `<tr><td style="padding:4px 0">${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${i.quantity}</td><td style="padding:4px 0;text-align:right">₹${i.line_total}</td></tr>`
      )
      .join("");

    // COD: confirmed, pay at the door. UPI/online: payment received.
    const isCod = order.payment_method === "cod";
    const subject = isCod ? `Order confirmed — Order ${order.order_number}` : `Payment received — Order ${order.order_number}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7a1730">${isCod ? "Order confirmed" : "Payment received"} — Order ${esc(order.order_number)}</h2>
        <p>Hi ${esc(order.full_name)}, ${
          isCod
            ? "your order is confirmed and will be shipped soon. Please keep the amount ready — you pay in cash when it is delivered."
            : "we've received your payment. Your order is now confirmed and will be shipped soon."
        }</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">${itemRows}</table>
        <p style="font-weight:bold">${isCod ? "Amount to pay on delivery" : "Total paid"}: ₹${order.total}</p>
        <p style="color:#78716c;font-size:13px">Shipping to: ${esc(order.address_line1)}, ${esc(order.city)}, ${esc(order.state)} ${esc(order.pincode)}</p>
      </div>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [order.email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      return json({ error: `Resend failed: ${errBody}` }, 502);
    }

    return json({ sent: true });
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
