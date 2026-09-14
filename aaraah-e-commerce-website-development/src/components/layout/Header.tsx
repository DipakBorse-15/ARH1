import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
      setMobileOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <button
          className="md:hidden"
          aria-label="Open menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>

        <Link to="/" className="mr-2 shrink-0 font-serif text-2xl font-bold tracking-wide text-rose-900">
          {siteConfig.name}
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-stone-700 md:flex">
          <Link to="/" className="transition hover:text-rose-900">
            Home
          </Link>
          <div className="group relative">
            <button className="flex items-center gap-1 py-4 transition hover:text-rose-900">Categories</button>
            <div className="invisible absolute left-0 top-full w-56 rounded-xl border border-stone-200 bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {siteConfig.categories.map((c) => (
                <Link key={c.slug} to={`/category/${c.slug}`} className="block rounded-lg px-3 py-2 hover:bg-stone-50">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="group relative">
            <button className="flex items-center gap-1 py-4 transition hover:text-rose-900">Collections</button>
            <div className="invisible absolute left-0 top-full w-56 rounded-xl border border-stone-200 bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {siteConfig.collections.map((c) => (
                <Link key={c.slug} to={`/collection/${c.slug}`} className="block rounded-lg px-3 py-2 hover:bg-stone-50">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden max-w-xs flex-1 items-center md:flex">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sarees, kurtis…"
            aria-label="Search products"
            className="w-full rounded-full border border-stone-300 bg-stone-50 px-4 py-2 text-sm focus:border-rose-900 focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-4 md:ml-0">
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Categories</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {siteConfig.categories.map((c) => (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Collections</p>
          <div className="grid grid-cols-2 gap-2">
            {siteConfig.collections.map((c) => (
              <Link
                key={c.slug}
                to={`/collection/${c.slug}`}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
