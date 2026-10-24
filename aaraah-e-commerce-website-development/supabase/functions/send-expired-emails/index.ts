// Supabase Edge Function: send-expired-emails
//
// Emails the customer when their unpaid UPI order was auto-cancelled (the database job
// expire_unpaid_orders marks such orders with cancel_reason = 'expired'). A cron job calls this
// every 15 minutes. Each order is emailed once (cancel_email_sent_at). It takes no input, so
// it is safe to run with "Verify JWT" switched OFF.
//
// Deploy:  Supabase Dashboard -> Edge Functions -> Deploy a new function -> name it `send-expired-emails`
//          paste this file, then open the function's Details/Settings and turn OFF "Enforce JWT verification".
// Secrets (already set for the other email functions): RESEND_API_KEY, RESEND_FROM

import { createClient } from "npm:@supabase/supabase-js@2";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ sent: 0, error: "RESEND_API_KEY is not set" }, 500);
    const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: orders, error } = await admin
      .from("orders")
      .select("id, order_number, full_name, email, total, items:order_items(product_name, color, quantity, line_total)")
      .eq("status", "cancelled")
      .eq("cancel_reason", "expired")
      .is("cancel_email_sent_at", null)
      .not("email", "is", null)
      .order("created_at", { ascending: true })
      .limit(30);
    if (error) {
      console.error(error);
      return json({ sent: 0, error: "Could not load orders" }, 500);
    }

    let sent = 0;
    for (const order of orders || []) {
      const itemRows = (order.items || [])
        .map(
          (i: { product_name: string; color: string | null; quantity: number; line_total: number }) =>
            `<tr><td style="padding:4px 0">${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${i.quantity}</td><td style="padding:4px 0;text-align:right">₹${i.line_total}</td></tr>`
        )
        .join("");

      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#7a1730">Order cancelled — Order ${esc(order.order_number)}</h2>
          <p>Hi ${esc(order.full_name)}, we did not receive the UPI payment for your order within 3 hours, so it has been cancelled and the items are available for others again.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">${itemRows}</table>
          <p style="font-weight:bold">Order total: ₹${order.total}</p>
          <p>If you have already paid, please contact us on WhatsApp +91 98983 52989 with your UTR / transaction number and we will sort it out. Otherwise you are welcome to place the order again on aaraah.in.</p>
          <p style="color:#78716c;font-size:13px">No payment was received for this order, so there is nothing to refund.</p>
        </div>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [order.email], subject: `Order cancelled — Order ${order.order_number}`, html }),
        });
        if (!res.ok) {
          console.error("Resend failed for", order.order_number, await res.text());
          continue; // tried again at the next run
        }
        await admin.from("orders").update({ cancel_email_sent_at: new Date().toISOString() }).eq("id", order.id);
        sent += 1;
      } catch (mailErr) {
        console.error(mailErr);
      }
    }
    return json({ sent });
  } catch (err) {
    console.error(err);
    return json({ sent: 0, error: "Unexpected server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
