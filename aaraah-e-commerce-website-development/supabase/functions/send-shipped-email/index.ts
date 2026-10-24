// Supabase Edge Function: send-shipped-email
//
// kind "shipped" (default): courier + tracking email. kind "delivered": "your order was delivered,
// please review / shop again" email with a review link for every product.
//
// Called from the admin Order Detail page when an order is marked shipped (or when the
// admin presses "Email tracking again"). Admin-only. Emails the customer the courier name,
// tracking number and tracking link saved on the order.
//
// Secrets (same as send-payment-confirmed-email): RESEND_API_KEY, optional RESEND_FROM.
// Deploy: Supabase Dashboard → Edge Functions → Deploy a new function → name it exactly
// "send-shipped-email" and paste this file.

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
    const { data: profile } = await admin.from("profiles").select("role").eq("user_id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const { order_id, kind } = await req.json();
    const delivered = kind === "delivered";
    if (!order_id) return json({ error: "order_id is required" }, 400);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("*, items:order_items(*, variant:product_variants(product:products(slug)))")
      .eq("id", order_id)
      .single();
    if (orderError || !order) return json({ error: "Order not found" }, 404);
    if (order.status === "cancelled") return json({ error: "This order is cancelled" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured" }, 501);
    const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";

    const itemRows = (order.items || [])
      .map(
        (i: { product_name: string; color: string | null; quantity: number }) =>
          `<li>${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${esc(i.quantity)}</li>`
      )
      .join("");

    // Only link to http(s) addresses (the admin typed this field).
    const url = typeof order.tracking_url === "string" && /^https?:\/\//i.test(order.tracking_url) ? order.tracking_url : "";
    const orderLink = `https://aaraah.in/account/orders/${order.id}`;

    if (delivered) {
      type Row = { product_name: string; color: string | null; variant?: { product?: { slug?: string } | { slug?: string }[] | null } | null };
      const reviewRows = (order.items || [])
        .map((i: Row) => {
          const prod = Array.isArray(i.variant?.product) ? i.variant?.product[0] : i.variant?.product;
          const slug = prod?.slug;
          return `<li style="margin:6px 0">${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""}${
            slug ? ` — <a href="https://aaraah.in/products/${encodeURIComponent(slug)}#reviews" style="color:#7a1730">Write a review</a>` : ""
          }</li>`;
        })
        .join("");
      const deliveredHtml = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#7a1730">Your order has been delivered — ${esc(order.order_number)}</h2>
          <p>Hi ${esc(order.full_name)}, your AARAAH order has been delivered. We hope you love it!</p>
          <p>Your review helps other customers (and us). It takes a minute:</p>
          <ul style="padding-left:18px;font-size:14px">${reviewRows}</ul>
          <p><a href="https://aaraah.in" style="display:inline-block;background:#7a1730;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Shop again</a></p>
          <p style="color:#78716c;font-size:13px">Something wrong with your order? Contact us within 48 hours of delivery with photos — see our <a href="https://aaraah.in/returns-and-refunds">Returns &amp; Refunds</a> page, or reply to this email.</p>
        </div>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [order.email], subject: `Delivered — how was your order ${order.order_number}?`, html: deliveredHtml }),
      });
      if (!r.ok) return json({ error: `Resend failed: ${await r.text()}` }, 502);
      return json({ sent: true });
    }

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7a1730">Your order is on the way — ${esc(order.order_number)}</h2>
        <p>Hi ${esc(order.full_name)}, good news! Your order has been shipped.</p>
        <table style="border-collapse:collapse;margin:12px 0;font-size:14px">
          ${order.courier_name ? `<tr><td style="padding:2px 12px 2px 0;color:#78716c">Courier</td><td><b>${esc(order.courier_name)}</b></td></tr>` : ""}
          ${order.tracking_number ? `<tr><td style="padding:2px 12px 2px 0;color:#78716c">Tracking number</td><td><b>${esc(order.tracking_number)}</b></td></tr>` : ""}
        </table>
        ${url ? `<p><a href="${esc(url)}" style="display:inline-block;background:#7a1730;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Track my package</a></p>` : ""}
        <ul style="padding-left:18px;font-size:14px">${itemRows}</ul>
        <p style="color:#78716c;font-size:13px">Delivering to: ${esc(order.address_line1)}, ${esc(order.city)}, ${esc(order.state)} ${esc(order.pincode)}<br>
        Delivery usually takes 5–7 working days. You can also see this on your <a href="${orderLink}">order page</a>.</p>
      </div>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [order.email], subject: `Your order is on the way — ${order.order_number}`, html }),
    });
    if (!resendRes.ok) return json({ error: `Resend failed: ${await resendRes.text()}` }, 502);

    return json({ sent: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}