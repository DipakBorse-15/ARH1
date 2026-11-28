import { Link } from "react-router-dom";
import { siteConfig } from "@/config/site";
import { useNavCategories, useNavCollections } from "@/hooks/useNavCategories";
import { categoryHref } from "@/lib/categoryLinks";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
    </svg>
  );
}

export function Footer() {
  const categories = useNavCategories();
  const navCollections = useNavCollections();
  const { settings, loading } = useSiteSettings();
  // Links come from Admin → Home Editor → Social Links. Only if settings could not be loaded at all, fall back to the built-in ones.
  const instagram = settings ? settings.instagram_url : loading ? null : siteConfig.social.instagram;
  const facebook = settings ? settings.facebook_url : loading ? null : siteConfig.social.facebook;
  const iconClass =
    "flex h-11 w-11 items-center justify-center rounded-full border border-rose-900/30 text-rose-900 transition hover:bg-rose-900 hover:text-white";
  return (
    <footer className="mt-16 border-t border-stone-200 bg-stone-50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <p className="font-serif text-2xl font-bold text-rose-900">{siteConfig.name}</p>
          <p className="mt-2 text-sm text-stone-500">{siteConfig.tagline}</p>
          {(instagram || facebook) && (
            <div className="mt-4 flex items-center gap-3">
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="AARAAH on Instagram" className={iconClass}>
                  <InstagramIcon />
                </a>
              )}
              {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="AARAAH on Facebook" className={iconClass}>
                  <FacebookIcon />
                </a>
              )}
            </div>
          )}
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Shop</h4>
          <ul className="space-y-2 text-sm text-stone-600">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link to={categoryHref(c.slug)} className="hover:text-rose-900">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Collections</h4>
          <ul className="space-y-2 text-sm text-stone-600">
            {navCollections.map((c) => (
              <li key={c.slug}>
                <Link to={`/collection/${c.slug}`} className="hover:text-rose-900">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Help</h4>
          <ul className="space-y-2 text-sm text-stone-600">
            <li>
              <Link to="/account/orders" className="hover:text-rose-900">
                Track Order
              </Link>
            </li>
            <li>
              <Link to="/faq" className="hover:text-rose-900">
                FAQs
              </Link>
            </li>
            <li>
              <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-rose-900">
                {siteConfig.supportEmail}
              </a>
            </li>
            <li>
              <a href={`tel:${siteConfig.supportPhone.replace(/\s/g, "")}`} className="hover:text-rose-900">
                {siteConfig.supportPhone}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-200 px-4 py-4 text-center text-xs text-stone-500">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Policies">
          <Link to="/about" className="hover:text-rose-900">About Us</Link>
          <Link to="/contact" className="hover:text-rose-900">Contact Us</Link>
          <Link to="/faq" className="hover:text-rose-900">FAQs</Link>
          <Link to="/shipping-policy" className="hover:text-rose-900">Shipping Policy</Link>
          <Link to="/returns-and-refunds" className="hover:text-rose-900">Cancellation &amp; Refund Policy</Link>
          <Link to="/privacy-policy" className="hover:text-rose-900">Privacy Policy</Link>
          <Link to="/terms-and-conditions" className="hover:text-rose-900">Terms &amp; Conditions</Link>
        </nav>
      </div>
      <div className="border-t border-stone-200 px-4 py-4 text-center text-xs leading-relaxed text-stone-500">
        <p>
          Sold by {siteConfig.sellerName}, Surat, Gujarat, India · {siteConfig.supportEmail} · {siteConfig.supportPhone}
        </p>
        <p>
          {siteConfig.grievanceOfficer}: <Link to="/contact" className="underline hover:text-rose-900">complaints &amp; contact</Link>
        </p>
      </div>
      <div className="border-t border-stone-200 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved. Made for Indian ethnic fashion lovers.
      </div>
    </footer>
  );
}
