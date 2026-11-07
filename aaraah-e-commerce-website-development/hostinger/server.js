// AARAAH on Hostinger (Node.js web app). No extra npm packages: only Node's built-in modules.
//
// What this one small server does (it replaces what Vercel did for us):
//   1. Serves the built website from ../dist and gives every other page the index.html (so refresh never 404s).
//   2. /sitemap.xml, /feed.xml and link-preview bots on /products/:slug -> the existing ../api/*.js code, unchanged.
//      Results are remembered for a few minutes, so bots cannot make Supabase work (and send data) again and again.
//   2b. /data/products-feed -> the product cards for Home / category / "similar" strips. Supabase is asked at most once
//      every 2 minutes for ALL visitors together (not once per visitor), so traffic growth cannot grow Supabase egress.
//   3. /img/<bucket>/<file>  -> the photo from Supabase Storage, kept on THIS server's disk after the first visit.
//      Each photo leaves Supabase only once, so Supabase "egress" stops growing with traffic.
//   4. (www / https redirects are left to Hostinger.)
//
// Start command on Hostinger:  node hostinger/server.js      (Build command: npm run build)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, "..");
const DIST = path.join(APP_ROOT, "dist");
const PORT = Number(process.env.PORT) || 3000;

const SUPABASE_URL = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`;
const BUCKETS = new Set(["product-images", "category-images", "collection-images", "hero-images", "site-images"]);

const IMG_CACHE_DIR = process.env.IMG_CACHE_DIR || path.join(APP_ROOT, ".img-cache");
const IMG_CACHE_MAX_BYTES = (Number(process.env.IMG_CACHE_MAX_MB) || 800) * 1024 * 1024;
const IMG_MAX_BYTES = 20 * 1024 * 1024; // one photo bigger than this is never proxied
const YEAR = 31536000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".xml", ".txt", ".svg", ".map"]);

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ------------------------------------------------------------------ */
/* 1. The three old Vercel functions (api/*.js), run as they are       */
/* ------------------------------------------------------------------ */
const handlers = {};
async function loadHandler(name) {
  if (!handlers[name]) {
    const mod = await import(pathToFileURL(path.join(APP_ROOT, "api", `${name}.js`)).href);
    handlers[name] = mod.default;
  }
  return handlers[name];
}

const BOT_UA = /(whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|pinterest|skypeuripreview)/i;

// Answers are remembered in memory: sitemap/feed 15 min, product preview 5 min. If Supabase fails, the older answer is reused.
const apiCache = new Map(); // key -> { at, ttl, status, headers, body }
const API_CACHE_MAX = 500;

function captureResponse() {
  const r = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(k, v) {
      r.headers[k] = v;
    },
    status(c) {
      r.statusCode = c;
      return r;
    },
    send(b) {
      r.body = b == null ? "" : b;
      return r;
    },
  };
  return r;
}

async function runApi(name, key, query, ttlMs, req, res) {
  const now = Date.now();
  const hit = apiCache.get(key);
  let out = hit && now - hit.at < hit.ttl ? hit : null;

  if (!out) {
    try {
      const fn = await loadHandler(name);
      const cap = captureResponse();
      await fn({ query, method: req.method, headers: req.headers, url: req.url }, cap);
      if (cap.statusCode >= 500 && hit) {
        out = hit; // Supabase had a hiccup: keep showing the last good answer
      } else {
        out = { at: now, ttl: cap.statusCode === 200 ? ttlMs : 60_000, status: cap.statusCode, headers: cap.headers, body: cap.body };
        if (cap.statusCode < 500) {
          if (apiCache.size >= API_CACHE_MAX) apiCache.delete(apiCache.keys().next().value);
          apiCache.set(key, out);
        }
      }
    } catch (err) {
      log("api error", name, err && err.message);
      if (hit) out = hit;
      else {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end("Temporarily unavailable");
        return;
      }
    }
  }

  const headers = { ...out.headers };
  // "s-maxage" was meant for Vercel's CDN; for browsers/bots use the same number as max-age.
  if (headers["Cache-Control"]) headers["Cache-Control"] = String(headers["Cache-Control"]).replace(/s-maxage=/g, "max-age=");
  res.writeHead(out.status, headers);
  res.end(req.method === "HEAD" ? undefined : out.body);
}

/* ------------------------------------------------------------------ */
/* 1b. /data/products-feed : product cards, asked from Supabase once   */
/*     per 2 minutes for everybody                                     */
/* ------------------------------------------------------------------ */
// KEEP IN SYNC with CARD_LITE_SELECT in src/services/products.ts
const FEED_SELECT =
  "id,brand,parent_sku,name,slug,category_id,collection_id,active,created_at," +
  "collection:collections(id,name,slug)," +
  "variants:product_variants(id,product_id,sku,color,color_hex,price,sale_price,discount_percent,discount_amount,stock_quantity,is_available,active,collection_id,sort_order,created_at,attributes," +
  "images:product_images(id,variant_id,url,thumb_url,alt_text,sort_order))";
const FEED_TTL_MS = 2 * 60_000;
let feedState = null; // { at, br, gz, raw }
let feedInflight = null;

async function buildFeed() {
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) throw new Error("Supabase not configured");
  const out = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=${encodeURIComponent(FEED_SELECT)}&active=eq.true&order=id.asc&limit=1000&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) }
    );
    if (!res.ok) throw new Error(`products ${res.status}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  const raw = Buffer.from(JSON.stringify(out));
  return {
    at: Date.now(),
    raw,
    br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }),
    gz: zlib.gzipSync(raw),
  };
}

async function serveFeed(req, res) {
  let st = feedState;
  if (!st || Date.now() - st.at >= FEED_TTL_MS) {
    try {
      if (!feedInflight) feedInflight = buildFeed().finally(() => (feedInflight = null));
      st = await feedInflight;
      feedState = st;
    } catch (err) {
      log("products-feed error:", err && err.message);
      // keep showing the last good copy if there is one; otherwise the browser falls back to asking Supabase itself
      if (!st) {
        res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end("Temporarily unavailable");
        return;
      }
    }
  }
  const accept = String(req.headers["accept-encoding"] || "");
  const useBr = /\bbr\b/.test(accept);
  const useGz = !useBr && /\bgzip\b/.test(accept);
  const body = useBr ? st.br : useGz ? st.gz : st.raw;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60",
    Vary: "Accept-Encoding",
    "Content-Length": body.length,
  };
  if (useBr) headers["Content-Encoding"] = "br";
  else if (useGz) headers["Content-Encoding"] = "gzip";
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}

/* ------------------------------------------------------------------ */
/* 2. /img/<bucket>/<path>  : photo cache on this server's disk        */
/* ------------------------------------------------------------------ */
let cacheReady = false;
try {
  fs.mkdirSync(IMG_CACHE_DIR, { recursive: true });
  cacheReady = true;
} catch (err) {
  log("img cache folder could not be created, photos will go straight to Supabase:", err.message);
}

const inflight = new Map(); // cache key -> Promise (many visitors asking for the same new photo = one download)

function cachePaths(key) {
  const h = crypto.createHash("sha1").update(key).digest("hex");
  return { body: path.join(IMG_CACHE_DIR, `${h}.bin`), meta: path.join(IMG_CACHE_DIR, `${h}.json`), hash: h };
}

function readCached(key) {
  if (!cacheReady) return null;
  const p = cachePaths(key);
  try {
    const meta = JSON.parse(fs.readFileSync(p.meta, "utf8"));
    const stat = fs.statSync(p.body);
    if (stat.size !== meta.size) return null;
    return { ...p, type: meta.type, size: meta.size };
  } catch {
    return null;
  }
}

async function downloadToCache(key, upstreamUrl) {
  const upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(20_000), redirect: "error" });
  if (upstream.status === 404 || upstream.status === 400) return { notFound: true };
  if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
  const type = String(upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) throw new Error(`not an image: ${type}`);
  const declared = Number(upstream.headers.get("content-length") || 0);
  if (declared > IMG_MAX_BYTES) throw new Error("too large");
  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.length > IMG_MAX_BYTES) throw new Error("too large");
  const p = cachePaths(key);
  const entry = { ...p, type, size: buf.length, buf };
  if (cacheReady) {
    try {
      const tmp = `${p.body}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, p.body);
      fs.writeFileSync(p.meta, JSON.stringify({ type, size: buf.length, key }));
      scheduleTrim();
    } catch (err) {
      log("img cache write failed (serving without saving):", err.message);
    }
  }
  return entry;
}

// Keep the cache folder under the size limit: when too big, delete the least recently used photos.
let trimTimer = null;
function scheduleTrim() {
  if (trimTimer) return;
  trimTimer = setTimeout(() => {
    trimTimer = null;
    try {
      const files = fs.readdirSync(IMG_CACHE_DIR).filter((f) => f.endsWith(".bin"));
      let total = 0;
      const rows = files.map((f) => {
        const st = fs.statSync(path.join(IMG_CACHE_DIR, f));
        total += st.size;
        return { f, size: st.size, t: st.atimeMs > st.mtimeMs ? st.atimeMs : st.mtimeMs };
      });
      if (total <= IMG_CACHE_MAX_BYTES) return;
      rows.sort((a, b) => a.t - b.t);
      for (const r of rows) {
        if (total <= IMG_CACHE_MAX_BYTES * 0.9) break;
        const base = r.f.slice(0, -4);
        fs.rmSync(path.join(IMG_CACHE_DIR, `${base}.bin`), { force: true });
        fs.rmSync(path.join(IMG_CACHE_DIR, `${base}.json`), { force: true });
        total -= r.size;
      }
    } catch (err) {
      log("img cache trim failed:", err.message);
    }
  }, 5000);
  trimTimer.unref();
}

async function serveImage(req, res, pathname) {
  // pathname = /img/<bucket>/<file path>
  const rest = pathname.slice("/img/".length);
  const slash = rest.indexOf("/");
  const bucket = slash > 0 ? rest.slice(0, slash) : "";
  const filePart = slash > 0 ? rest.slice(slash + 1) : "";
  let decoded = "";
  try {
    decoded = decodeURIComponent(filePart);
  } catch {
    decoded = "";
  }
  const bad = !SUPABASE_URL || !BUCKETS.has(bucket) || !decoded || decoded.split("/").some((s) => s === ".." || s === ".") || decoded.includes("\\") || decoded.includes("\0");
  if (bad) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Not found");
    return;
  }

  const upstreamUrl = `${STORAGE_PREFIX}${bucket}/${filePart}`;
  const key = `${bucket}/${decoded}`;

  let entry = readCached(key);
  const hit = !!entry;
  if (!entry) {
    try {
      let p = inflight.get(key);
      if (!p) {
        p = downloadToCache(key, upstreamUrl).finally(() => inflight.delete(key));
        inflight.set(key, p);
      }
      entry = await p;
    } catch (err) {
      // Never leave a visitor without a photo: send them to Supabase directly this one time.
      log("img proxy fallback to Supabase:", key, err && err.message);
      res.writeHead(302, { Location: upstreamUrl, "Cache-Control": "no-store" });
      res.end();
      return;
    }
    if (entry.notFound) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" });
      res.end("Not found");
      return;
    }
  }

  const etag = `"${entry.hash}-${entry.size}"`;
  const headers = {
    "Content-Type": entry.type,
    "Cache-Control": `public, max-age=${YEAR}, immutable`, // every upload gets a new file name, so a photo never changes
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "X-Img-Cache": hit ? "HIT" : "MISS",
  };
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  headers["Content-Length"] = entry.size;
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  if (entry.buf) {
    res.end(entry.buf);
    return;
  }
  const stream = fs.createReadStream(entry.body);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}

/* ------------------------------------------------------------------ */
/* 3. The website files (dist/)                                        */
/* ------------------------------------------------------------------ */
const zipCache = new Map(); // file -> { mtime, br, gz }

function sendFile(req, res, file, stat, ext, opts = {}) {
  const type = MIME[ext] || "application/octet-stream";
  const headers = { "Content-Type": type, "X-Content-Type-Options": "nosniff" };
  const base = path.basename(file);
  if (opts.immutable) headers["Cache-Control"] = `public, max-age=${YEAR}, immutable`;
  else if (ext === ".html" || base === "pwa-admin-sw.js" || base === "sw.js") headers["Cache-Control"] = "no-cache";
  else if (base === "robots.txt" || ext === ".webmanifest" || ext === ".xml") headers["Cache-Control"] = "public, max-age=3600";
  else headers["Cache-Control"] = "public, max-age=86400";
  headers.ETag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  headers.Vary = "Accept-Encoding";

  if (req.headers["if-none-match"] === headers.ETag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }

  const accept = String(req.headers["accept-encoding"] || "");
  if (COMPRESSIBLE.has(ext) && stat.size > 512 && stat.size < 8 * 1024 * 1024 && /\b(br|gzip)\b/.test(accept)) {
    let z = zipCache.get(file);
    if (!z || z.mtime !== stat.mtimeMs) {
      const raw = fs.readFileSync(file);
      z = {
        mtime: stat.mtimeMs,
        br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }),
        gz: zlib.gzipSync(raw, { level: 9 }),
      };
      zipCache.set(file, z);
    }
    const useBr = /\bbr\b/.test(accept);
    headers["Content-Encoding"] = useBr ? "br" : "gzip";
    const body = useBr ? z.br : z.gz;
    headers["Content-Length"] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }

  headers["Content-Length"] = stat.size;
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = fs.createReadStream(file);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}

function serveStatic(req, res, pathname) {
  let rel = "";
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    rel = pathname;
  }
  const target = path.normalize(path.join(DIST, rel));
  if (target !== DIST && !target.startsWith(DIST + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      const ext = path.extname(target).toLowerCase();
      sendFile(req, res, target, stat, ext, { immutable: rel.startsWith("/assets/") });
      return;
    }
  } catch {
    /* not a file: fall through */
  }
  // A missing /assets/... file must be a real 404 (never the home page dressed up as a script).
  if (rel.startsWith("/assets/")) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Not found");
    return;
  }
  // Every other address is a page of the single-page app.
  const indexFile = path.join(DIST, "index.html");
  try {
    sendFile(req, res, indexFile, fs.statSync(indexFile), ".html");
  } catch {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Site is being built, please retry in a minute.");
  }
}

/* ------------------------------------------------------------------ */
/* 4. Router                                                           */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      res.end("ok");
      return;
    }

    // www / http redirects are handled by Hostinger itself (our own redirect fought with it and caused a loop).
    // Google still sees https://aaraah.in as the address, because every page carries that canonical link.

    if (pathname === "/data/products-feed") {
      await serveFeed(req, res);
      return;
    }

    if (pathname.startsWith("/img/")) {
      await serveImage(req, res, pathname);
      return;
    }

    const query = Object.fromEntries(url.searchParams.entries());

    if (pathname === "/sitemap.xml" || pathname === "/api/sitemap") {
      await runApi("sitemap", "sitemap", query, 15 * 60_000, req, res);
      return;
    }
    if (pathname === "/feed.xml" || pathname === "/api/feed") {
      await runApi("feed", "feed", query, 15 * 60_000, req, res);
      return;
    }
    if (pathname === "/api/product") {
      const q = { ...query };
      await runApi("product", `product:${q.slug || ""}:${q.variant || ""}`, q, 5 * 60_000, req, res);
      return;
    }
    const prod = /^\/products\/([^/]+)\/?$/.exec(pathname);
    if (prod && BOT_UA.test(String(req.headers["user-agent"] || ""))) {
      let slug = prod[1];
      try {
        slug = decodeURIComponent(slug);
      } catch {
        /* keep raw */
      }
      const q = { ...query, slug };
      await runApi("product", `product:${slug}:${q.variant || ""}`, q, 5 * 60_000, req, res);
      return;
    }
    if (pathname.startsWith("/api/")) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      res.end("Not found");
      return;
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    log("request error", req.url, err && err.message);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Server error");
  }
});

server.keepAliveTimeout = 65_000;
server.listen(PORT, () => {
  log(`AARAAH server on port ${PORT} | dist: ${DIST} | img cache: ${cacheReady ? IMG_CACHE_DIR : "off"} | supabase: ${SUPABASE_URL ? "set" : "NOT SET"}`);
});

process.on("unhandledRejection", (err) => log("unhandledRejection", err && err.message));
process.on("uncaughtException", (err) => log("uncaughtException", err && err.message));
