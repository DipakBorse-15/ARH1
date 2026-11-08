// Supabase Edge Function: cancel-order
//
// One place that cancels an order, for both people who can do it:
//   * the CUSTOMER who owns the order — only while it is pending / confirmed /
//     processing (not once it has shipped)
//   * an ADMIN — any time
//
// What it does: sets the order to "cancelled" (a database trigger then puts the
// stock back), and emails the customer. If the email fails the order is still
// cancelled — the response says `emailed: false` so the UI can warn.
// Calling it again on an already-cancelled order does nothing (no second email).
//
// Deploy:   Supabase Dashboard → Edge Functions → Deploy a new function → name it `cancel-order`
// Secrets (same ones send-payment-confirmed-email already uses):
//   RESEND_API_KEY, RESEND_FROM (e.g. "AARAAH <orders@aaraah.in>")

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CUSTOMER_CANCELLABLE = ["pending", "confirmed", "processing"];
// Nobody can cancel an order once it is shipped or delivered (the database also refuses it: the goods have already left).
const ADMIN_CANCELLABLE = ["pending", "confirmed", "processing"];

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
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id;
    if (!orderId || typeof orderId !== "string") return json({ error: "order_id is required" }, 400);

    const { data: profile } = await admin.from("profiles").select("role").eq("user_id", userId).maybeSingle();
    const isAdmin = profile?.role === "admin";

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) return json({ error: "Could not load the order" }, 500);

    // A stranger gets the same answer as a missing order (no leaking order ids).
    if (!order || (!isAdmin && order.user_id !== userId)) return json({ error: "Order not found" }, 404);

    if (order.status === "cancelled") return json({ cancelled: true, emailed: false, already: true });

    if (order.status === "delivered") {
      return json({ error: "A delivered order cannot be cancelled." }, 409);
    }
    if (order.status === "shipped") {
      return json({ error: "This order has already been shipped, so it can no longer be cancelled." }, 409);
    }

    if (!isAdmin && !CUSTOMER_CANCELLABLE.includes(order.status)) {
      return json({ error: "This order has already been shipped, so it can no longer be cancelled." }, 409);
    }

    // Only cancel if the status is still what we just read (admin may have
    // shipped it a moment ago). The DB trigger restores the stock.
    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("status", order.status)
      .in("status", isAdmin ? ADMIN_CANCELLABLE : CUSTOMER_CANCELLABLE)
      .select("id");
    if (updateError) {
      console.error(updateError);
      return json({ error: "Could not cancel the order" }, 500);
    }
    if (!updated || updated.length === 0) {
      return json({ error: "The order status just changed. Please refresh and try again." }, 409);
    }

    // ---- Tell the shop owner when a CUSTOMER cancels an order that was already PAID: money to refund (best effort) ----
    if (!isAdmin && order.user_id === userId && order.payment_status === "paid") {
      try {
        await sendAdminRefundEmail(order);
      } catch (e) {
        console.error("admin refund email failed", e);
      }
    }

    // ---- Email (best effort) -------------------------------------------------
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey || !order.email) return json({ cancelled: true, emailed: false });
    const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";

    const cancelledByCustomer = !isAdmin && order.user_id === userId;
    const itemRows = (order.items || [])
      .map(
        (i: { product_name: string; color: string | null; quantity: number; line_total: number }) =>
          `<tr><td style="padding:4px 0">${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${i.quantity}</td><td style="padding:4px 0;text-align:right">₹${i.line_total}</td></tr>`
      )
      .join("");

    const refundNote =
      order.payment_status === "paid"
        ? `We had received your payment of ₹${order.total}. We will contact you shortly about your refund.`
        : "No payment was received for this order, so there is nothing to refund.";

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7a1730">Order cancelled — Order ${esc(order.order_number)}</h2>
        <p>Hi ${esc(order.full_name)}, ${
          cancelledByCustomer
            ? "as requested, your order has been cancelled."
            : "we're sorry — your order has been cancelled."
        }</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">${itemRows}</table>
        <p style="font-weight:bold">Order total: ₹${order.total}</p>
        <p>${refundNote}</p>
        <p style="color:#78716c;font-size:13px">If you have any questions, please contact us.</p>
      </div>`;

    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          reply_to: "aaraah.in@gmail.com",
          to: [order.email],
          subject: `Order cancelled — Order ${order.order_number}`,
          html,
        }),
      });
      if (!resendRes.ok) {
        console.error("Resend failed:", await resendRes.text());
        return json({ cancelled: true, emailed: false });
      }
    } catch (mailErr) {
      console.error(mailErr);
      return json({ cancelled: true, emailed: false });
    }

    return json({ cancelled: true, emailed: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

// Short mail to the shop owner: "customer cancelled a paid order - refund pending". Needs RESEND_API_KEY;
// optional secret ADMIN_NOTIFY_EMAIL (default aaraah.in@gmail.com, same as the new-order mail).
async function sendAdminRefundEmail(order: {
  id: string;
  order_number: string;
  full_name: string;
  mobile: string;
  total: number;
  payment_reference: string | null;
  items?: { product_name: string; color: string | null; quantity: number }[];
}) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  const to = Deno.env.get("ADMIN_NOTIFY_EMAIL") || "aaraah.in@gmail.com";
  const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";
  const lines = (order.items || [])
    .map((i) => `<li>${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${esc(i.quantity)}</li>`)
    .join("");
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#7a1730">Paid order cancelled — refund karna hai</h2>
      <p>Customer ne apna <b>paid</b> order <b>${esc(order.order_number)}</b> cancel kiya. Stock wapas aa gaya.</p>
      <p><b>₹${esc(order.total)}</b> wapas dena hai · ${esc(order.full_name)} · ${esc(order.mobile)}${order.payment_reference ? ` · UTR ${esc(order.payment_reference)}` : ""}</p>
      <ul>${lines}</ul>
      <p>Paisa wapas karne ke baad order me <b>Refund mark</b> karo.</p>
      <p><a href="https://aaraah.in/admin/orders/${esc(order.id)}" style="display:inline-block;background:#7a1730;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open order</a></p>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `Refund needed — ${order.order_number} cancelled by customer (₹${order.total})`, html }),
    signal: AbortSignal.timeout(5000),
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}