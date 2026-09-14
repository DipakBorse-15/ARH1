# AARAAH.IN — Premium Indian Ethnic Wear E-Commerce

A production-oriented, full-stack e-commerce storefront + admin panel for Indian ethnic wear
(sarees, kurtis, dress materials, kurta sets). The frontend is a **static React/Vite SPA**
deployable on **GitHub Pages**, backed entirely by **Supabase** (PostgreSQL, Auth, Storage,
Row Level Security, Edge Functions). No Node.js/Express server is required to run the frontend.

```
                 ┌─────────────────────┐
                 │     GitHub Pages    │   React + Vite + TypeScript + Tailwind
                 └──────────┬──────────┘
                            │ Supabase JS client
                            ▼
                 ┌─────────────────────┐
                 │      Supabase       │   Auth · PostgreSQL · Storage · RLS · Edge Functions
                 └─────────────────────┘
```

---

## 1. Technology Stack

- React 19 + TypeScript (strict)
- Vite 7 (static build, code-split, lazy-loaded routes)
- Tailwind CSS v4
- React Router v6 (client-side routing, GitHub Pages 404 fallback)
- Supabase JS client (`@supabase/supabase-js`)
- Supabase Postgres + RLS, Supabase Auth, Supabase Storage
- Supabase Edge Functions (Deno/TypeScript) for trusted order/payment logic
- GitHub Actions → GitHub Pages deployment

No Express, no Next.js server runtime, no Prisma, no Firebase, no MongoDB.

---

## 2. Project Structure

```
src/
  components/       Reusable UI (product, cart, layout, account, ui/)
  pages/            Route-level pages (storefront + admin/ + account/)
  layouts/          MainLayout (storefront) / AdminLayout
  routes/           ProtectedRoute / AdminRoute guards
  contexts/         AuthContext, CartContext, ToastContext
  services/         Supabase data-access layer (products, cart, orders, ...)
  lib/              Supabase client + error helpers
  config/           Centralised site/env configuration
  types/            Shared TypeScript domain types

supabase/
  migrations/       SQL schema, RLS policies, storage policies, seed taxonomy
  functions/        Edge Functions: create-order, create-payment, verify-payment

.github/workflows/deploy.yml   GitHub Actions → GitHub Pages
public/                        robots.txt, sitemap.xml (static hosting SEO)
```

---

## 3. Product / Variant Architecture (critical)

`products` (parent design) → `product_variants` (color/size/etc.) → `product_images` (per variant)

- A single design (e.g. **Saree Design A**) has many **variants** (Red, Blue, Green, Pink), each
  with its own **SKU, price, sale price, stock, availability, and images**.
- `product_variants.attributes` is a `jsonb` bag so the system is **extendable** beyond color to
  size, fabric, pattern, length, etc. without a schema rewrite.
- Cart, order items and inventory are always keyed by **`variant_id`**, never the parent product —
  buying "Red" never touches "Blue" stock.
- Product URLs: `/products/:slug?variant=<color-slug>` — opening any color shows *all* sibling
  colors, highlights the active one, and updates images/price/SKU/stock instantly on switch.

---

## 4. GitHub Pages Deployment

### 4.1 Base path configuration

`vite.config.ts` reads `VITE_BASE_PATH` (falls back to `/`) so the exact same code works at:

| Target                          | `VITE_BASE_PATH`      |
|----------------------------------|------------------------|
| Local dev (`npm run dev`)        | `/` (default)          |
| GitHub Pages project site        | `/REPOSITORY-NAME/`    |
| Custom domain (`aaraah.in`)      | `/`                     |

`src/config/site.ts` exposes the same value to the app, and `App.tsx` passes it as the React
Router `basename` — so internal links, canonical URLs and asset paths always match the deployed
base path. **Never hard-code `/REPOSITORY-NAME/` anywhere else.**

### 4.2 SPA routing fallback (404.html)

GitHub Pages is static hosting with no server-side rewrites. A Vite plugin in `vite.config.ts`
(`githubPagesFallback`) generates `dist/404.html` at build time, automatically computing how many
path segments to preserve based on `VITE_BASE_PATH` (0 for root/custom domain, 1 for a project
site). `index.html` contains the matching restore script. Deep links (e.g. a refreshed
`/products/saree-design-a`) and browser refreshes work correctly.

### 4.3 GitHub Actions

`.github/workflows/deploy.yml`:

1. Checks out the repo
2. Installs Node 20 + dependencies (`npm ci`)
3. Builds with Vite, auto-computing `VITE_BASE_PATH` from the repository name (or `/` if a
   `public/CNAME` file is present, i.e. a custom domain)
4. Uploads `dist/` as a Pages artifact
5. Deploys via `actions/deploy-pages`
6. Runs on every push to `main`, and supports manual dispatch (`workflow_dispatch`)

**To enable:** GitHub repo → Settings → Pages → Source: "GitHub Actions". Push to `main`.

### 4.4 Custom domain (aaraah.in)

1. Add a `public/CNAME` file containing exactly `aaraah.in` (this repo intentionally does not
   ship one — add it only when you're ready to point the domain here).
2. Point your DNS `A`/`ALIAS`/`CNAME` records at GitHub Pages per GitHub's custom-domain docs.
3. The workflow automatically switches `VITE_BASE_PATH` to `/` once `public/CNAME` exists.

---

## 5. Supabase Setup

### 5.1 Create a project

Create a project at [supabase.com](https://supabase.com), then copy the **Project URL** and
**anon/publishable key** (Project Settings → API).

### 5.2 Run the database migrations

In the Supabase SQL editor (or via `supabase db push` with the CLI), run the files in
`supabase/migrations/` **in order**:

1. `0001_schema.sql` — tables, indexes, triggers, `is_admin()` helper
2. `0002_rls.sql` — Row Level Security policies for every table
3. `0003_storage.sql` — storage buckets (`product-images`, `category-images`,
   `collection-images`) + public-read / admin-write policies
4. `0004_seed_taxonomy.sql` — seeds the 4 categories + 4 collections (no fake products)
5. `0005_inventory_functions.sql` — safe, concurrency-friendly stock decrement function

### 5.3 Create your admin user

1. Sign up normally through the site (`/register`) — a `profiles` row is auto-created via trigger.
2. In the Supabase SQL editor, promote that user:
   ```sql
   update public.profiles set role = 'admin' where email = 'owner@aaraah.in';
   ```
3. Sign in — you can now access `/admin`.

### 5.4 Deploy Edge Functions (optional but recommended)

```bash
supabase functions deploy create-order
supabase functions deploy create-payment
supabase functions deploy verify-payment
```

`create-order` re-validates price/stock/availability server-side before creating an order and
decrementing variant-specific inventory — the browser is never trusted with money.
`create-payment` / `verify-payment` are ready-to-extend stubs for a real Indian payment gateway
(see §7).

---

## 6. Environment Variables

Copy `.env.example` to `.env` for local development:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLIC-ANON-KEY
VITE_BASE_PATH=/
VITE_SITE_NAME=AARAAH
VITE_SITE_URL=https://aaraah.in
```

Only the public URL + anon key are used in the frontend (safe to expose — protected by RLS).
**Never** put the Supabase service role key, or any payment gateway secret, in frontend code or
in a `VITE_*` variable — those belong only in Supabase Edge Function secrets.

### Required GitHub Secrets (Settings → Secrets and variables → Actions)

| Name                             | Used for                                   |
|----------------------------------|---------------------------------------------|
| `VITE_SUPABASE_URL`              | Build-time Supabase URL                     |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | Build-time Supabase anon key                |

(Optional repo variable `VITE_SITE_URL` for canonical URLs.)

Supabase Edge Function secrets (set with `supabase secrets set`, never in GitHub):
`SUPABASE_SERVICE_ROLE_KEY` (auto-provided by Supabase), and later e.g.
`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.

---

## 7. Payment Architecture

Checkout currently supports **Cash on Delivery** end-to-end (real order creation, real stock
decrement, real order records). Online payment is architected but intentionally **not faked**:

- `create-payment` and `verify-payment` Edge Functions are stubs that return a clear
  "gateway not configured" response instead of pretending payment succeeded.
- To go live with Razorpay/Cashfree/PhonePe: implement the gateway order-creation call in
  `create-payment` using a server-side secret, verify the signature in `verify-payment`, and only
  then mark `orders.payment_status = 'paid'`. No frontend changes are required beyond calling
  the existing `supabase.functions.invoke(...)` pattern already used in `src/services/orders.ts`.

---

## 8. Local Development

```bash
npm install
cp .env.example .env   # fill in your Supabase project values
npm run dev             # http://localhost:5173
```

## 9. Build & Deploy Commands

```bash
npm run build      # produces dist/ (static build, works standalone)
npm run preview     # preview the production build locally
```

Push to `main` with GitHub Pages → Actions enabled and the workflow deploys automatically.

---

## 10. Testing Checklist

- [ ] `npm run build` completes with no errors, `dist/` is generated
- [ ] Home, category, collection, product, cart, checkout, login, register, account, admin routes
      all render
- [ ] Refreshing a deep link (e.g. `/products/some-slug`) works after deployment (404.html fallback)
- [ ] Opening a product with `?variant=blue` selects the Blue variant; switching color updates
      images/price/SKU/stock without navigating away, and all sibling colors remain visible
- [ ] Adding Red and Blue variants of the same design creates **two separate cart lines**
- [ ] Changing Blue's quantity does not change Red's quantity
- [ ] Buying Red does not reduce Blue's stock (and vice-versa)
- [ ] Checkout validates required fields and shows inline errors
- [ ] Placing a COD order creates a real order + order items snapshot + decrements variant stock
- [ ] A customer cannot view another customer's orders/addresses (verify via RLS)
- [ ] A non-admin cannot reach `/admin` or write to products/categories/collections/orders
- [ ] Admin can create a parent product, add variants with SKU/price/stock, upload images per
      variant, publish it, and see it appear on the storefront
- [ ] Admin dashboard numbers reflect real Supabase data (no hard-coded stats)

---

## 11. Known Limitations

- Online payment gateways (Razorpay/Cashfree/PhonePe) are architected but not wired to a live
  gateway — COD is the only functioning payment method until you add real gateway credentials
  server-side (see §7).
- The static `public/sitemap.xml` is a skeleton; because content lives in Supabase, regenerate it
  periodically (e.g. a small script that queries Supabase and rewrites the file) and redeploy.
- Filtering by color/price/stock is applied after fetching a page of products from Supabase; for
  very large catalogs, consider a Postgres function/view that pre-aggregates variant price ranges
  for more efficient server-side filtering.
- Search is a simple `ilike` match on name/brand/description; consider Postgres full-text search
  or `pg_trgm` for larger catalogs.

---

## 12. Security Notes

- RLS is enabled on every table; the frontend never relies solely on route guards.
- `decrement_variant_stock` is `security definer` and revoked from `anon`/`authenticated` — only
  the Edge Function (using the service role key) can call it, preventing client-side stock
  tampering.
- Order totals are always recalculated server-side in `create-order` from the live
  `product_variants` table — the browser's price is never trusted.
- Order items store a **snapshot** of product name/color/SKU/price so historical orders remain
  accurate even if the catalog changes later.
