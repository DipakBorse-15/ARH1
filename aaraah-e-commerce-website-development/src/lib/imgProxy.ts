/**
 * Customer-facing photo URLs.
 *
 * Photos live in Supabase Storage (public buckets). Every time a visitor downloads one straight from
 * Supabase it counts against the free "egress" quota. When the site runs on Hostinger, the Node server in
 * `hostinger/server.js` serves the same photos from `/img/<bucket>/<path>` and keeps a copy on its own disk,
 * so each photo leaves Supabase only once.
 *
 * This is switched on only when the build has VITE_IMG_PROXY=1 (set in Hostinger). On Vercel / local dev the
 * variable is absent, so every URL stays exactly as it is today. Nothing in the database changes, and
 * Google / Merchant / SEO keep using the original Supabase URLs.
 */
const BASE = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const ENABLED = import.meta.env.VITE_IMG_PROXY === "1";
const PREFIX = `${BASE}/storage/v1/object/public/`;

export function imgSrc(url: string): string;
export function imgSrc(url?: string | null): string | undefined;
export function imgSrc(url?: string | null): string | undefined {
  if (!url) return url ?? undefined;
  if (!ENABLED || !BASE || !url.startsWith(PREFIX)) return url;
  return `/img/${url.slice(PREFIX.length)}`;
}
