import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { siteConfig } from "@/config/site";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useNavCategories } from "@/hooks/useNavCategories";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const categories = useNavCategories();

  const categoryLinks = categories.map((c) => ({ label: c.name.toUpperCase(), to: `/category/${c.slug}` }));
  const collectionLinks = siteConfig.collections.map((c) => ({ label: c.name.toUpperCase(), to: `/collection/${c.slug}` }));
  // Mobile menu shows everything in one grid.
  const navLinks = [...categoryLinks, ...collectionLinks];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setSearchOpen(false);
      setMobileOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <button className="md:hidden" aria-label="Open menu" onClick={() => setMobileOpen((o) => !o)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>

        <Link to="/" className="mr-1 flex shrink-0 items-center gap-2">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={settings.site_name || siteConfig.name} className="h-9 w-auto object-contain" />
          ) : (
            <span className="font-serif text-2xl font-bold tracking-wide text-rose-900">
              {settings?.site_name || siteConfig.name}
            </span>
          )}
        </Link>

        {/* Centered nav — categories (newest launch first), collections tucked into a dropdown
            so six long category names still fit on one line. */}
        <nav className="hidden flex-1 items-center justify-center gap-5 text-sm font-medium tracking-wide text-stone-700 md:flex">
          {categoryLinks.map((link) => (
            <Link key={link.to} to={link.to} className="whitespace-nowrap py-4 transition hover:text-rose-900">
              {link.label}
            </Link>
          ))}
          <div className="group relative">
            <button type="button" className="whitespace-nowrap py-4 transition hover:text-rose-900" aria-haspopup="true">
              COLLECTIONS ▾
            </button>
            <div className="invisible absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 rounded-lg border border-stone-200 bg-white py-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {collectionLinks.map((link) => (
                <Link key={link.to} to={link.to} className="block px-4 py-2 text-stone-700 hover:bg-stone-50 hover:text-rose-900">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen((o) => !o)}
            className="hidden text-stone-700 hover:text-rose-900 md:block"
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" strokeLinecap="round" />
            </svg>
          </button>
          <Link to={user ? "/account" : "/login"} aria-label="Account" className="text-stone-700 hover:text-rose-900">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
          <Link to="/cart" aria-label="Cart" className="relative text-stone-700 hover:text-rose-900">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6h15l-1.5 9h-12z" />
              <path d="M6 6 5 3H2" />
              <circle cx="9" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-900 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Expanding search row (desktop) */}
      {searchOpen && (
        <div className="hidden border-t border-stone-200 bg-stone-50 px-4 py-3 md:block">
          <form onSubmit={submitSearch} className="mx-auto max-w-7xl">
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sarees, kurties, lehengas…"
              aria-label="Search products"
              className="w-full max-w-md rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
          </form>
        </div>
      )}

      {mobileOpen && (
        <div className="border-t border-stone-200 bg-white px-4 py-4 md:hidden">
          <form onSubmit={submitSearch} className="mb-4 flex">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-full border border-stone-300 px-4 py-2 text-sm"
            />
          </form>
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
