import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-stone-50">
      <NewsletterBar />

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-5">
        <div className="col-span-2 md:col-span-1">
          <p className="font-serif text-2xl font-bold text-rose-900">{siteConfig.name}</p>
          <p className="mt-2 text-sm text-stone-500">{siteConfig.tagline}</p>
          <div className="mt-4 flex gap-3">
            <SocialIcon label="Instagram" href="#">
              <InstagramIcon />
            </SocialIcon>
            <SocialIcon label="Facebook" href="#">
              <FacebookIcon />
            </SocialIcon>
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Shop</h4>
          <ul className="space-y-2 text-sm text-stone-600">
            {siteConfig.categories.map((c) => (
              <li key={c.slug}>
                <Link to={`/category/${c.slug}`} className="hover:text-rose-900">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Collections</h4>
          <ul className="space-y-2 text-sm text-stone-600">
            {siteConfig.collections.map((c) => (
              <li key={c.slug}>
                <Link to={`/collection/${c.slug}`} className="hover:text-rose-900">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Account</h4>
          <ul className="space-y-2 text-sm text-stone-600">
            <li>
              <Link to="/account" className="hover:text-rose-900">
                My Account
              </Link>
            </li>
            <li>
              <Link to="/account/orders" className="hover:text-rose-900">
                Track Order
              </Link>
            </li>
            <li>
              <Link to="/account/addresses" className="hover:text-rose-900">
                Addresses
              </Link>
            </li>
            <li>
              <Link to="/cart" className="hover:text-rose-900">
                Cart
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Contact Us</h4>
          <ul className="space-y-2 text-sm text-stone-600">
            <li>
              <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-rose-900">
                {siteConfig.supportEmail}
              </a>
            </li>
            <li>
              <a href={`tel:${siteConfig.supportPhone}`} className="hover:text-rose-900">
                {siteConfig.supportPhone}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-200 py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">We accept</p>
          <PaymentIcons />
        </div>
      </div>

      <div className="border-t border-stone-200 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved. Made for Indian ethnic fashion lovers.
      </div>
    </footer>
  );
}

/** "Get Insider Access" strip — UI only for now; wire to a signups table
 *  later when the newsletter actually needs to collect emails. */
function NewsletterBar() {
  return (
    <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-amber-900 py-10 text-center text-white">
      <h3 className="font-serif text-xl font-semibold sm:text-2xl">Get Insider Access</h3>
      <p className="mt-1 text-sm text-rose-50/80">New arrivals, festive drops & exclusive offers — straight to your inbox.</p>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto mt-5 flex max-w-md flex-col gap-2 px-4 sm:flex-row sm:px-0"
      >
        <input
          type="email"
          placeholder="Your email address"
          className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/60 focus:border-white/50 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-rose-900 transition hover:bg-rose-50"
        >
          Subscribe
        </button>
      </form>
    </div>
  );
}

function SocialIcon({ label, href, children }: { label: string; href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-stone-500 transition hover:border-rose-900 hover:text-rose-900"
    >
      {children}
    </a>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.4c0-.9.25-1.5 1.56-1.5H16.6V4.2C16.33 4.16 15.4 4 14.3 4 12 4 10.5 5.37 10.5 8.1v2.3H8v3h2.5V21h3Z" />
    </svg>
  );
}

/** Simple text-badge payment icons — no external logo assets needed. */
function PaymentIcons() {
  const methods = ["UPI", "Visa", "Mastercard", "RuPay", "COD"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {methods.map((m) => (
        <span
          key={m}
          className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500"
        >
          {m}
        </span>
      ))}
    </div>
  );
}
