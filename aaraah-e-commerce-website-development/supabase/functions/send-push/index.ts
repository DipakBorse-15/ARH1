// Supabase Edge Function: send-push
//
// Sends a phone alert ("push notification") to every admin phone that switched alerts on
// (table push_subscriptions). Called by:
//   - create-order (new order), and
//   - database triggers (UTR submitted, paid order cancelled, low stock) through public.push_notify().
// Only callers that send the header  x-push-key  (same value as secret PUSH_KEY) are accepted.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Deploy a new function -> Via Editor -> name `send-push`,
//         paste this file, Deploy. Then in the function's settings turn OFF "Enforce JWT verification".
// Secrets (Edge Functions -> Secrets): PUSH_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  try {
    const expected = Deno.env.get("PUSH_KEY");
    if (!expected || req.headers.get("x-push-key") !== expected) return json({ error: "Not allowed" }, 401);

    const pub = Deno.env.get("VAPID_PUBLIC_KEY");
    const priv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!pub || !priv) return json({ error: "VAPID keys are not set" }, 500);
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:aaraah.in@gmail.com", pub, priv);

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "AARAAH").slice(0, 120);
    const text = String(body.body || "").slice(0, 300);
    const url = typeof body.url === "string" && body.url.startsWith("/admin") ? body.url : "/admin/orders";
    const tag = typeof body.tag === "string" ? body.tag.slice(0, 80) : undefined;
    const payload = JSON.stringify({ title, body: text, url, tag });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    if (error) return json({ error: error.message }, 500);

    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      (subs || []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            TTL: 60 * 60 * 24,
            urgency: "high",
          });
          sent += 1;
        } catch (e) {
          // deno-lint-ignore no-explicit-any
          const code = (e as any)?.statusCode;
          if (code === 404 || code === 410) dead.push(s.id); // phone removed the alert permission / app
          else console.error("push failed", code, (e as Error)?.message);
        }
      })
    );
    if (dead.length > 0) await supabase.from("push_subscriptions").delete().in("id", dead);
    return json({ sent, removed: dead.length });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected error" }, 500);
  }
});
