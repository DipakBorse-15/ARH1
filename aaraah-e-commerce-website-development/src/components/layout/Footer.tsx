import { Link } from "react-router-dom";
import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-stone-50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <p className="font-serif text-2xl font-bold text-rose-900">{siteConfig.name}</p>
          <p className="mt-2 text-sm text-stone-500">{siteConfig.tagline}</p>
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
          <h4 className="mb-3 text-sm font-semibold text-stone-900">Help</h4>
          <ul className="space-y-2 text-sm text-stone-600">
            <li>
              <Link to="/account/orders" className="hover:text-rose-900">
                Track Order
              </Link>
            </li>
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
      <div className="border-t border-stone-200 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved. Made for Indian ethnic fashion lovers.
      </div>
    </footer>
  );
}
