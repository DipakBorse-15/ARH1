// Supabase Edge Function: razorpay-payment
//
// ONE function for everything that happens AFTER the order exists (create-order makes the order and the
// Razorpay order). It answers three kinds of calls:
//
//   1. Razorpay WEBHOOK  (header x-razorpay-signature)  — events payment.captured / order.paid.
//      This is the safety net: even if the customer closes the browser right after paying, the order
//      still becomes "paid + confirmed" because Razorpay tells us directly.
//   2. Browser  {action:"pay_info", order_id}   — customer's own unpaid order -> what the payment window needs.
//   3. Browser  {action:"verify", order_id, razorpay_payment_id, razorpay_order_id, razorpay_signature}
//      — right after the payment window says "success": signature + payment are checked, order becomes paid.
//
// Marking an order paid is one database call (razorpay_mark_paid), so the browser and the webhook arriving
// together can never double-process an order. Late payment on an auto-cancelled order: the order is re-opened
// if stock is still there, otherwise the money is refunded automatically.
//
// Deploy:  Supabase Dashboard -> Edge Functions -> Deploy a new function (Via Editor) -> name `razorpay-payment`
//          -> paste this file -> then Details/Settings -> turn OFF "Enforce JWT verification"
//          (Razorpay's webhook has no login; the webhook signature and the customer's token are checked in the code).
// Secrets (Edge Functions -> Secrets): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
//   (already there for other functions: RESEND_API_KEY, RESEND_FROM; optional PUSH_KEY, ADMIN_NOTIFY_EMAIL)

import { createClient } from "npm:@supabase/supabase-js@2";

const PAY_MINUTES = 30; // keep the same as expire_razorpay_orders(30) in migration 0045 and RAZORPAY_PAY_MINUTES in the website

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type Db = ReturnType<typeof createClient>;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- crypto helpers
async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------- Razorpay API
async function rzp(path: string, method: "GET" | "POST", body?: unknown): Promise<Row> {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new HttpError(500, "Razorpay keys are not set");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let data: Row = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* keep empty */
  }
  if (!res.ok) {
    const msg = data?.error?.description || `Razorpay error ${res.status}`;
    const err = new HttpError(res.status, msg);
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------- small helpers
const paise = (rupees: unknown) => Math.round(Number(rupees) * 100);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Runs mails / push / refunds after the reply has gone out (Supabase keeps the function alive until they finish). */
function background(work: () => Promise<unknown>) {
  const run = () => work().catch((e) => console.error("background task failed", e));
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(run());
  else void run();
}

async function sendMail(to: string, subject: string, html: string, replyTo = true) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to) return;
  const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, ...(replyTo ? { reply_to: "aaraah.in@gmail.com" } : {}), to: [to], subject, html }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) console.error("Resend failed", res.status, await res.text());
}
const adminMail = () => Deno.env.get("ADMIN_NOTIFY_EMAIL") || "aaraah.in@gmail.com";

async function sendPush(orderId: string, title: string, body: string) {
  const key = Deno.env.get("PUSH_KEY");
  const base = Deno.env.get("SUPABASE_URL");
  if (!key || !base) return;
  await fetch(`${base}/functions/v1/send-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-push-key": key },
    body: JSON.stringify({ title, body, url: `/admin/orders/${orderId}`, tag: `order-${orderId}` }),
    signal: AbortSignal.timeout(8000),
  });
}

function itemRows(order: Row) {
  return (order.items || [])
    .map(
      (i: Row) =>
        `<tr><td style="padding:4px 0">${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${esc(i.quantity)}</td><td style="padding:4px 0;text-align:right">₹${esc(i.line_total)}</td></tr>`
    )
    .join("");
}

// ---------------------------------------------------------------- what happens once money is confirmed
type Settled = "paid" | "reopened" | "already" | "refunded";

async function loadOrderByRazorpayId(admin: Db, rzpOrderId: string): Promise<Row | null> {
  const { data, error } = await admin.from("orders").select("*, items:order_items(*)").eq("razorpay_order_id", rzpOrderId).maybeSingle();
  if (error) throw new HttpError(500, "Could not load the order");
  return data as Row | null;
}

async function settle(admin: Db, order: Row, paymentId: string, paidPaise: number): Promise<Settled> {
  // The money must match the order exactly. A mismatch is never marked paid; the shop owner is told.
  if (paidPaise !== paise(order.total)) {
    console.error("amount mismatch", order.order_number, paidPaise, paise(order.total));
    background(() =>
      sendMail(
        adminMail(),
        `Razorpay amount mismatch — ${order.order_number}`,
        `<p>Order <b>${esc(order.order_number)}</b> (₹${esc(order.total)}) got a payment of ₹${paidPaise / 100} (${esc(paymentId)}). The order was NOT marked paid. Check it in the Razorpay dashboard.</p>`,
        false
      )
    );
    throw new HttpError(409, "The paid amount does not match the order. We will check it and contact you.");
  }

  const { data: result, error } = await admin.rpc("razorpay_mark_paid", { p_order_id: order.id, p_payment_id: paymentId });
  if (error) {
    console.error("razorpay_mark_paid failed", error);
    throw new HttpError(500, "Could not record the payment");
  }

  if (result === "already") return "already";

  if (result === "paid" || result === "reopened") {
    background(async () => {
      // Cart: a normal order empties the bought items from the cart now (not at order time), a "Buy Now" order leaves the cart alone.
      if (!order.buy_now) {
        const ids = (order.items || []).map((i: Row) => i.variant_id).filter(Boolean);
        if (ids.length) await admin.from("cart_items").delete().eq("user_id", order.user_id).in("variant_id", ids);
      }
      await Promise.allSettled([
        sendMail(
          order.email,
          `Payment received — Order ${order.order_number}`,
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#7a1730">Payment received — Order ${esc(order.order_number)}</h2>
            <p>Hi ${esc(order.full_name)}, we've received your payment. Your order is now confirmed and will be shipped soon.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">${itemRows(order)}</table>
            <p style="font-weight:bold">Total paid: ₹${esc(order.total)}</p>
            <p style="color:#78716c;font-size:13px">Shipping to: ${esc(order.address_line1)}, ${esc(order.city)}, ${esc(order.state)} ${esc(order.pincode)}</p>
            <p><a href="https://aaraah.in/account/orders/${esc(order.id)}" style="display:inline-block;background:#7a1730;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open my order</a></p>
          </div>`
        ),
        sendMail(
          adminMail(),
          `New PAID order ${order.order_number} — ₹${order.total}`,
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#7a1730">New paid order — ${esc(order.order_number)}</h2>
            <p><b>₹${esc(order.total)}</b> · ${esc(order.full_name)} · ${esc(order.mobile)} · ${esc(order.city)}, ${esc(order.state)}</p>
            <ul>${(order.items || []).map((i: Row) => `<li>${esc(i.product_name)}${i.color ? ` (${esc(i.color)})` : ""} × ${esc(i.quantity)}</li>`).join("")}</ul>
            <p>Razorpay se payment aa chuka hai (${esc(paymentId)}). Order apne aap <b>Confirmed</b> hai: pack karke ship karo.${
              result === "reopened" ? " <b>Note:</b> ye order 30 minute baad auto-cancel ho gaya tha, par paisa late aaya, isliye wapas khol diya." : ""
            }</p>
            <p><a href="https://aaraah.in/admin/orders/${esc(order.id)}" style="display:inline-block;background:#7a1730;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open order</a></p>
          </div>`,
          false
        ),
        sendPush(order.id, `Naya order (paid): ${order.order_number}`, `Rs ${order.total} - ${order.full_name}`),
      ]);
    });
    return result === "reopened" ? "reopened" : "paid";
  }

  if (result === "no_stock" || result === "duplicate_payment") {
    // Money arrived but we cannot honour it (items sold meanwhile / paid twice): give it back automatically.
    const wholeOrderLost = result === "no_stock";
    background(async () => {
      let refundOk = false;
      try {
        await rzp(`/payments/${paymentId}/refund`, "POST", {
          speed: "normal",
          notes: { reason: wholeOrderLost ? "Items sold out before payment arrived" : "Duplicate payment", order_number: order.order_number },
        });
        refundOk = true;
      } catch (e) {
        console.error("auto refund failed", e);
      }
      if (refundOk && wholeOrderLost) {
        await admin.from("orders").update({ payment_status: "refunded", razorpay_payment_id: paymentId }).eq("id", order.id);
      }
      await Promise.allSettled([
        refundOk
          ? sendMail(
              order.email,
              `Refund initiated — Order ${order.order_number}`,
              `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#7a1730">Refund initiated — Order ${esc(order.order_number)}</h2>
                <p>Hi ${esc(order.full_name)}, ${
                  wholeOrderLost
                    ? "your payment reached us after the payment time was over, and the items had been sold to another customer in the meantime, so we could not keep this order."
                    : "we received a second payment for the same order."
                } We have refunded <b>₹${esc(order.total)}</b>. It reaches your account in about 5–7 working days.</p>
                <p>We are sorry for the trouble. You are welcome to order again on aaraah.in.</p>
              </div>`
            )
          : Promise.resolve(),
        sendMail(
          adminMail(),
          refundOk ? `Auto refund done — ${order.order_number}` : `URGENT: refund FAILED — ${order.order_number}`,
          `<p>Order <b>${esc(order.order_number)}</b>, payment <b>${esc(paymentId)}</b>, ₹${esc(order.total)}: ${
            wholeOrderLost ? "paisa late aaya aur stock khatam tha" : "ye dobara (duplicate) payment thi"
          }. ${refundOk ? "Razorpay se refund apne aap initiate ho gaya." : "<b>Refund apne aap NAHI ho paya. Razorpay dashboard se manually refund karo.</b>"}</p>`,
          false
        ),
      ]);
    });
    return "refunded";
  }

  throw new HttpError(404, "Order not found");
}

// ---------------------------------------------------------------- 1) webhook
async function handleWebhook(req: Request, signature: string, admin: Db): Promise<Response> {
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Webhook secret is not set" }, 500);
  const raw = await req.text();
  const expected = await hmacHex(secret, raw);
  if (!safeEqual(expected, signature)) return json({ error: "Bad signature" }, 400);

  let body: Row;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Bad body" }, 400);
  }
  const event = String(body.event ?? "");
  if (event !== "payment.captured" && event !== "order.paid") return json({ ok: true, ignored: event });

  const payment: Row | undefined = body?.payload?.payment?.entity;
  if (!payment?.id || !payment?.order_id) return json({ ok: true, ignored: "no payment" });
  if (payment.status && payment.status !== "captured") return json({ ok: true, ignored: `status ${payment.status}` });

  try {
    const order = await loadOrderByRazorpayId(admin, String(payment.order_id));
    if (!order) return json({ ok: true, ignored: "unknown order" }); // not one of ours: nothing to retry
    const outcome = await settle(admin, order, String(payment.id), Number(payment.amount));
    return json({ ok: true, outcome });
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) return json({ ok: true, ignored: "amount mismatch" }); // retrying never helps
    console.error("webhook failed", e);
    return json({ error: "Could not process" }, 500); // Razorpay retries a few times
  }
}

// ---------------------------------------------------------------- 2) + 3) browser calls
async function handleBrowser(req: Request, admin: Db): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Please sign in first." }, 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Please sign in first." }, 401);
  const userId = userData.user.id;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const orderId = String(body?.order_id ?? "");
  if (!orderId) return json({ error: "order_id is required" }, 400);

  const { data: order, error } = await admin.from("orders").select("*, items:order_items(*)").eq("id", orderId).maybeSingle();
  if (error) return json({ error: "Could not load the order" }, 500);
  // A stranger gets the same answer as a missing order.
  if (!order || order.user_id !== userId || order.payment_method !== "razorpay") return json({ error: "Order not found" }, 404);

  // ---- pay_info: what the payment window needs
  if (action === "pay_info") {
    if (order.payment_status === "paid") return json({ error: "This order is already paid." }, 409);
    if (order.status === "cancelled") {
      return json({ error: "This order was cancelled because the payment time (30 minutes) was over. Please place the order again." }, 409);
    }
    if (!order.razorpay_order_id) return json({ error: "Payment could not be started for this order. Please place the order again." }, 409);
    const expiresAt = new Date(order.created_at).getTime() + PAY_MINUTES * 60_000;
    if (Date.now() > expiresAt) return json({ error: "The payment time (30 minutes) is over. Please place the order again." }, 409);
    return json({
      key_id: Deno.env.get("RAZORPAY_KEY_ID"),
      razorpay_order_id: order.razorpay_order_id,
      amount: paise(order.total),
      currency: "INR",
      expires_at: new Date(expiresAt).toISOString(),
    });
  }

  // ---- verify: right after the payment window reports success
  if (action === "verify") {
    const paymentId = String(body?.razorpay_payment_id ?? "");
    const rzpOrderId = String(body?.razorpay_order_id ?? "");
    const signature = String(body?.razorpay_signature ?? "");
    if (!paymentId || !rzpOrderId || !signature) return json({ error: "Missing payment details" }, 400);
    if (rzpOrderId !== order.razorpay_order_id) return json({ error: "This payment does not belong to this order." }, 400);

    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!secret) return json({ error: "Payment is not set up yet" }, 500);
    const expected = await hmacHex(secret, `${rzpOrderId}|${paymentId}`);
    if (!safeEqual(expected, signature)) return json({ error: "Payment could not be verified." }, 400);

    // Ask Razorpay itself: right order, right amount, and really taken (captured).
    let payment = await rzp(`/payments/${encodeURIComponent(paymentId)}`, "GET");
    if (payment.order_id !== rzpOrderId) return json({ error: "This payment does not belong to this order." }, 400);
    if (payment.status === "authorized") {
      // Account is set to manual capture: take the money now.
      payment = await rzp(`/payments/${encodeURIComponent(paymentId)}/capture`, "POST", { amount: payment.amount, currency: payment.currency || "INR" });
    }
    if (payment.status !== "captured") {
      return json({ error: `Payment is ${payment.status || "not complete"} yet. If money was deducted it will be confirmed automatically.` }, 409);
    }

    try {
      const outcome = await settle(admin, order, paymentId, Number(payment.amount));
      if (outcome === "refunded") {
        return json({
          status: "refunded",
          message:
            order.status === "cancelled"
              ? "Your payment reached us after the payment time, and the items were sold meanwhile. We are refunding it automatically (5–7 working days)."
              : "This order was already paid. We are refunding the extra payment automatically (5–7 working days).",
        });
      }
      return json({ status: "paid" });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      throw e;
    }
  }

  return json({ error: "Unknown action" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const signature = req.headers.get("x-razorpay-signature");
    if (signature) return await handleWebhook(req, signature, admin);
    return await handleBrowser(req, admin);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status >= 500 ? 502 : err.status);
    console.error(err);
    return json({ error: "Unexpected server error" }, 500);
  }
});
