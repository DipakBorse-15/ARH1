// Supabase Edge Function: weekly-backup
//
// Every Sunday 03:00 IST a database cron job calls this function. It reads the shop's data and EMAILS it
// to the shop mailbox aaraah.in@gmail.com (only that address), so a copy always lives outside Supabase,
// in Gmail. Nothing is stored in Supabase (no extra storage), nothing is shown on the
// website, and nobody has to remember anything.
//
// The email has 3 attachments:
//   1. aaraah-backup-DATE.json.gz  - EVERYTHING, exactly as stored (used to restore; ask Claude)
//   2. orders-DATE.csv             - all orders, opens in Excel
//   3. stock-and-prices-DATE.csv   - every colour/SKU: price, selling price, stock, active (opens in Excel)
//
// NOT included: the photo files themselves (they stay in Supabase Storage; only their addresses are
// saved) and customers' passwords (Supabase never hands those out). Customer emails + names ARE included.
//
// Only the cron job can start it: it must send the header  x-cron-key  with the same value as the
// secret BACKUP_CRON_KEY. So nobody else can trigger it.
//
// Deploy:  Supabase Dashboard -> Edge Functions -> Deploy a new function -> Via Editor -> name `weekly-backup`
//          paste this file, Deploy. Then open the function's settings and turn OFF "Enforce JWT verification"
//          (the cron job authenticates with x-cron-key instead).
// Secrets: BACKUP_CRON_KEY (new), RESEND_API_KEY and RESEND_FROM (already set for the other email functions)

import { createClient } from "npm:@supabase/supabase-js@2";

// Tables that make up the shop. A missing/unreadable table is noted in the email, it never stops the backup.
const TABLES = [
  "products",
  "product_variants",
  "product_images",
  "categories",
  "collections",
  "category_collections",
  "hero_slides",
  "site_settings",
  "profiles",
  "addresses",
  "orders",
  "order_items",
  "coupons",
  "coupon_redemptions",
  "reviews",
  "wishlist_items",
];

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // keep the email comfortably below Resend/Gmail limits

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req) => {
  try {
    const expected = Deno.env.get("BACKUP_CRON_KEY");
    if (!expected || req.headers.get("x-cron-key") !== expected) return json({ error: "Not allowed" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY is not set" }, 500);
    const from = Deno.env.get("RESEND_FROM") || "AARAAH <onboarding@resend.dev>";
    const resendUrl = Deno.env.get("RESEND_API_URL") || "https://api.resend.com/emails"; // only changed in tests

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Read every table (page by page: the API returns at most 1000 rows per request).
    const data: Record<string, Row[]> = {};
    const problems: string[] = [];
    for (const table of TABLES) {
      try {
        data[table] = await readTable(admin, table);
      } catch (err) {
        data[table] = [];
        problems.push(`${table}: ${(err as Error).message}`);
      }
    }

    // 2) Customer logins (email + dates only; Supabase never exposes passwords).
    const authUsers: Row[] = [];
    try {
      for (let page = 1; page <= 50; page++) {
        const { data: res, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const users = res?.users || [];
        users.forEach((u) =>
          authUsers.push({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at })
        );
        if (users.length < 1000) break;
      }
    } catch (err) {
      problems.push(`auth users: ${(err as Error).message}`);
    }
    data["auth_users"] = authUsers;

    // 3) Who receives it: ONLY the shop mailbox (aaraah.in@gmail.com). Optional secret BACKUP_NOTIFY_EMAIL overrides it.
    const recipients: string[] = [Deno.env.get("BACKUP_NOTIFY_EMAIL") || "aaraah.in@gmail.com"];

    // 4) Build the 3 files.
    const day = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST date
    const jsonBytes = new TextEncoder().encode(JSON.stringify({ made_at: new Date().toISOString(), tables: data }));
    const gz = await gzip(jsonBytes);
    const ordersCsv = toCsv(
      data["orders"].map((o) => ({
        order_number: o.order_number,
        created_at: o.created_at,
        name: o.full_name,
        mobile: o.mobile,
        email: o.email,
        status: o.status,
        payment_status: o.payment_status,
        total: o.total,
        utr: o.payment_reference,
        courier: o.courier_name,
        tracking: o.tracking_number,
        city: o.city,
        state: o.state,
        pincode: o.pincode,
      }))
    );
    const nameOf = new Map<string, string>(data["products"].map((p) => [p.id, p.name]));
    const stockCsv = toCsv(
      data["product_variants"].map((v) => ({
        design: nameOf.get(v.product_id) ?? "",
        sku: v.sku,
        colour: v.color,
        mrp: v.price,
        selling_price: v.sale_price,
        stock: v.stock_quantity,
        active: v.active,
      }))
    );

    const attachments: { filename: string; content: string }[] = [];
    let skippedBig = false;
    if (gz.length <= MAX_ATTACHMENT_BYTES) attachments.push({ filename: `aaraah-backup-${day}.json.gz`, content: toBase64(gz) });
    else skippedBig = true;
    attachments.push({ filename: `orders-${day}.csv`, content: toBase64(new TextEncoder().encode("﻿" + ordersCsv)) });
    attachments.push({ filename: `stock-and-prices-${day}.csv`, content: toBase64(new TextEncoder().encode("﻿" + stockCsv)) });

    // 5) Email it.
    const counts = [...Object.entries(data)]
      .map(([t, rows]) => `<tr><td style="padding:2px 12px 2px 0">${t}</td><td style="text-align:right">${rows.length}</td></tr>`)
      .join("");
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#7a1730">AARAAH weekly backup — ${day}</h2>
        <p>Ye aapki site ka is hafte ka backup hai. Is mail ko <b>delete mat kariye</b> (Gmail me star ya label laga dijiye).</p>
        <ul>
          <li><b>aaraah-backup-${day}.json.gz</b> — poora data. Kuch bigad jaye to Claude ko ye file dijiye, wo data wapas daal dega.</li>
          <li><b>orders-${day}.csv</b> — saare orders (Excel me khulta hai).</li>
          <li><b>stock-and-prices-${day}.csv</b> — har colour/SKU ka price aur stock (Excel me khulta hai).</li>
        </ul>
        <p style="color:#78716c;font-size:13px">Isme product photos ki files aur customers ke passwords nahi hote (photos Supabase Storage me rehti hain).</p>
        ${skippedBig ? `<p style="color:#b91c1c"><b>Dhyan dein:</b> poora backup email ke liye bahut bada ho gaya, isliye sirf CSV files judi hain. Claude se kahiye ki backup ka tareeka badle.</p>` : ""}
        ${problems.length ? `<p style="color:#b91c1c"><b>Kuch tables nahi padhe ja sake:</b><br>${problems.map(esc).join("<br>")}</p>` : ""}
        <table style="font-size:13px;color:#57534e;border-collapse:collapse">${counts}</table>
      </div>`;

    const res = await fetch(resendUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients, subject: `AARAAH weekly backup — ${day}`, html, attachments }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Resend failed", text);
      return json({ error: "Email could not be sent", detail: text.slice(0, 300) }, 502);
    }
    return json({ sent: true, to: recipients.length, tables: Object.fromEntries(Object.entries(data).map(([t, r]) => [t, r.length])), problems });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

async function readTable(admin: ReturnType<typeof createClient>, table: string): Promise<Row[]> {
  const out: Row[] = [];
  let ordered = true;
  for (let from = 0; from < 200000; from += 1000) {
    let q = admin.from(table).select("*");
    if (ordered) q = q.order("id", { ascending: true });
    let { data, error } = await q.range(from, from + 999);
    if (error && ordered && from === 0) {
      // a table without an "id" column: read it without ordering
      ordered = false;
      ({ data, error } = await admin.from(table).select("*").range(from, from + 999));
    }
    if (error) throw new Error(error.message);
    const rows = (data || []) as Row[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    // A leading = @ (or + / - followed by a non-number) would make Excel run the cell as a formula, so those get a quote in front.
    let s = v == null ? "" : String(v);
    if (/^(=|@|[+\-][^\d\s.])/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}