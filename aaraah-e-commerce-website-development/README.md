# AARAAH — aaraah.in (saree & ethnic wear store)

React single-page storefront + admin panel, backed by Supabase. Hosted on a Hostinger Web App (Node.js).
This file is the short, current overview. (Old GitHub Pages / Vercel notes no longer apply.)

## Stack
- Vite 7, React 19, TypeScript (strict), Tailwind 4, react-router-dom 7. Alias `@/` = `src`.
- Supabase: Postgres + RLS, Auth, Storage, Edge Functions. Email: Resend (`orders@aaraah.in`).
- Hosting: Hostinger Web App. A push to `main` builds and restarts it automatically (2-5 minutes).
- `npm run build` = `vite build` (no type-check). Type-check separately: `npx tsc --noEmit -p .`.
- `npm start` = `node hostinger/server.js`.

## Hostinger app settings
Framework preset **Other / Express** (the Vite preset is static-only), root `aaraah-e-commerce-website-development`,
build `npm run build`, output `dist`, **entry file `hostinger/server.js`**, Node 22. Hostinger itself does the
www / https redirects, so `server.js` must not add its own (it caused a redirect loop once).

`hostinger/server.js` serves `dist/` with SPA fallback, plus: `/sitemap.xml`, `/feed.xml` (Merchant Center),
bot preview for `/products/:slug`, `/img/<bucket>/<path>` (customer photos cached on disk, saves Supabase egress),
`/data/products-feed` (2-minute cache), `/healthz`. The code for sitemap / feed / preview lives in `api/*.js`.

## Environment variables (names only, set in hPanel, plain text)
`VITE_SUPABASE_URL` (base URL only), `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`VITE_BASE_PATH` (`/`), `VITE_SITE_NAME`, `VITE_SITE_URL`, `VITE_UPI_ID`, `VITE_UPI_PAYEE_NAME`, `VITE_GA_ID`,
`VITE_META_PIXEL_ID`, `VITE_IMG_PROXY` (`1` = photos via `/img`). `VITE_*` are read at build time, so changing one
needs a rebuild. Never put a Supabase secret (`sb_secret_...`) key in the frontend or env.

## Folders
```
hostinger/server.js     Node server (see above)
api/                    sitemap, feed, product preview code used by server.js (vercel.json is only for the old Vercel rollback)
src/                    components, pages (storefront, account, admin), contexts, services (DB calls), lib (pure logic), types
public/                 favicons, robots.txt, admin phone-app (PWA) files
supabase/migrations/    SQL history (run by hand in the Supabase SQL Editor, in number order; uploading to GitHub does not run them)
supabase/schema/        live-schema-2026-11-08.sql = snapshot of the live database (REFERENCE ONLY, never run it on the live project;
                        use it to rebuild a new Supabase project)
supabase/functions/     Edge Functions: create-order, cancel-order, send-payment-confirmed-email, send-shipped-email,
                        send-expired-emails, weekly-backup (deployed by hand from the Supabase dashboard)
```
These function copies were made equal to the deployed ones on 8 Nov 2026. After you change a function in Supabase, put the
same code here too, so the copy never becomes older than the live one.

## Data model (short)
- `products` = design (parent). `product_variants` = colour / SKU (child). Each colour shows as its own card.
- Prices: `price` = MRP, `sale_price` = selling price (NULL = no discount). `is_available` follows stock.
- Orders, order_items, coupons, reviews, wishlist, hero_slides, site_settings, categories (6), collections (4).
- Payment: manual UPI QR + UTR, admin confirms. COD is off. Free shipping.
- Unpaid UPI orders without a UTR are auto-cancelled by pg_cron (3 hours; night rule in migration 0036).

## Admin
`/admin/login`. Admin role is set only from the SQL Editor (`profiles.role`). On phones the admin is a small
order / stock app (PWA); listing, import and SEO tools are laptop-only.

## Checks before a change goes live
`npx tsc --noEmit -p .` then `npm run build`.

## Backups
Edge Function `weekly-backup` (Sunday 03:00 IST via pg_cron) emails a JSON + CSV backup to the shop mailbox.
Product photo files are not part of it.
