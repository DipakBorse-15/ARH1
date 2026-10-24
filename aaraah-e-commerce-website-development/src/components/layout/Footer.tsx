import { Link } from "react-router-dom";
import { siteConfig } from "@/config/site";
import { useNavCategories, useNavCollections } from "@/hooks/useNavCategories";
import { categoryHref } from "@/lib/categoryLinks";

export function Footer() {
  const categories = useNavCategories();
  const navCollections = useNavCollections();
  return (
    <footer className="mt-16 border-t border-stone-200 bg-stone-50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <p className="font-serif text-2xl font-bold text-rose-900">{siteConfig.name}</p>
          <p className="mt-2 text-sm text-stone-500">{siteConfig.tagline}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
            <a href={siteConfig.social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-rose-900">
              Instagram
            </a>
            <a href={siteConfig.social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-rose-900">
              Facebook
            </a>
            <a href={`https://wa.me/${siteConfig.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-rose-900">
              WhatsApp
            </a>
          </div>
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
          <Link to="/returns-and-refunds" className="hover:text-rose-900">Returns &amp; Refunds</Link>
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
