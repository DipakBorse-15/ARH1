import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { siteConfig } from "@/config/site";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useNavCategories, useNavCollections } from "@/hooks/useNavCategories";
import { categoryHref } from "@/lib/categoryLinks";

// Web menu look: Cinzel capitals; on hover the item fills with deep maroon, the text turns
// white and a gold line draws in under it (with a clear gap between the text and the line).
const NAV_LINK =
  "group/nav relative whitespace-nowrap px-2 pb-3.5 pt-2 text-[10.5px] font-medium uppercase tracking-[0.02em] text-stone-700 transition-colors duration-300 hover:bg-[#7a1730] hover:text-white focus-visible:bg-[#7a1730] focus-visible:text-white lg:px-3 lg:text-[11.5px] lg:tracking-[0.04em] xl:px-3.5 xl:text-[13px] xl:tracking-[0.06em]";
const NAV_LINE =
  "pointer-events-none absolute inset-x-0 bottom-1.5 mx-auto h-px w-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent transition-all duration-500 ease-out group-hover/nav:w-[75%] group-focus-visible/nav:w-[75%] group-hover:w-[75%] group-focus-within:w-[75%]";

// Web menu font: Cinzel Medium (500), loaded once from Google Fonts.
function ensureMenuFont() {
  if (document.getElementById("menu-font-cinzel")) return;
  const link = document.createElement("link");
  link.id = "menu-font-cinzel";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@500&display=swap";
  document.head.appendChild(link);
}
const MENU_FONT = { fontFamily: '"Cinzel", Georgia, serif' };

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const categories = useNavCategories();
  const navCollections = useNavCollections();

  useEffect(() => {
    ensureMenuFont();
  }, []);

  const categoryLinks = categories.map((c) => ({ label: c.name.toUpperCase(), to: categoryHref(c.slug) }));
  const collectionLinks = navCollections.map((c) => ({ label: c.name.toUpperCase(), to: `/collection/${c.slug}` }));
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
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-1.5 sm:px-6 md:py-0.5">
        <button className="min-[1340px]:hidden" aria-label="Open menu" onClick={() => setMobileOpen((o) => !o)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>

        <Link to="/" className="mr-1 flex shrink-0 items-center gap-2">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={settings.site_name || siteConfig.name} className="h-[54px] w-auto object-contain md:h-[72px]" />
          ) : (
            <span className="font-serif text-2xl font-bold tracking-wide text-rose-900">
              {settings?.site_name || siteConfig.name}
            </span>
          )}
        </Link>

        {/* Centered nav — categories (newest launch first), collections tucked into a dropdown
            so six long category names still fit on one line. */}
        <nav style={MENU_FONT} className="hidden flex-1 items-center justify-center gap-2 text-sm font-medium text-stone-700 min-[1340px]:flex min-[1340px]:gap-5">
          {categoryLinks.map((link) => (
            <Link key={link.to} to={link.to} className={NAV_LINK}>
              {link.label}
              <span className={NAV_LINE} />
            </Link>
          ))}
          <div className="group relative">
            <button type="button" className={`${NAV_LINK} group-hover:bg-[#7a1730] group-hover:text-white group-focus-within:bg-[#7a1730] group-focus-within:text-white`} aria-haspopup="true">
              COLLECTIONS
              <span aria-hidden="true" className="ml-1.5 inline-block text-[9px] transition-transform duration-300 group-hover:rotate-180">
                ▼
              </span>
              <span className={NAV_LINE} />
            </button>
            <div className="invisible absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 translate-y-2 rounded-xl border border-amber-200/70 border-t-2 border-t-amber-600 bg-white py-2 opacity-0 shadow-xl shadow-rose-900/10 transition-all duration-300 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
              {collectionLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="relative block px-6 py-2.5 text-[12.5px] tracking-[0.08em] text-stone-700 transition-all duration-300 before:absolute before:left-3 before:top-1/2 before:h-px before:w-0 before:bg-white before:transition-all before:duration-300 hover:bg-[#7a1730] hover:pl-8 hover:text-white hover:before:w-3.5"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-4 min-[1340px]:ml-0">
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
        <div className="border-t border-stone-200 bg-white px-4 py-4 min-[1340px]:hidden">
          <form onSubmit={submitSearch} className="mb-4 flex">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-full border border-stone-300 px-4 py-2 text-sm"
            />
          </form>
          {/* Same Cinzel look as the web menu. Phones have no hover, so a tap (and the page you are on)
              fills the item with maroon and draws the gold line. */}
          <div style={MENU_FONT} className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => {
              const current = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`group/m relative rounded-lg px-3 pb-3.5 pt-2.5 text-[12px] font-medium uppercase leading-snug tracking-[0.04em] transition-colors duration-200 active:bg-[#7a1730] active:text-white ${
                    current ? "bg-[#7a1730] text-white" : "bg-stone-50 text-stone-700"
                  }`}
                >
                  {link.label}
                  <span
                    className={`pointer-events-none absolute inset-x-0 bottom-1.5 mx-auto h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent transition-all duration-300 group-active/m:w-[75%] ${
                      current ? "w-[75%]" : "w-0"
                    }`}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
