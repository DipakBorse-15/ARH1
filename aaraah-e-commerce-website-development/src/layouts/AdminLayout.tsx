import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPwa } from "@/lib/adminPwa";
import { adminLinks } from "@/layouts/adminLinks";

function pageTitle(pathname: string): string {
  if (/^\/admin\/orders\/.+/.test(pathname)) return "Order";
  if (pathname === "/admin/orders") return "Orders";
  if (pathname === "/admin/more") return "More";
  if (/^\/admin\/products\/(new)$/.test(pathname)) return "New listing";
  if (/^\/admin\/products\/.+/.test(pathname)) return "Edit product";
  if (pathname === "/admin/dashboard" || pathname === "/admin") return "Dashboard";
  const hit = adminLinks.find((l) => !l.end && (pathname === l.to || pathname.startsWith(`${l.to}/`)));
  return hit?.label ?? "Admin";
}

// Small line icons for the bottom tab bar.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const OrdersIcon = () => (
  <Icon>
    <path d="M6 3h12a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z" />
    <path d="M9 8h6M9 12h6" />
  </Icon>
);
const ProductsIcon = () => (
  <Icon>
    <path d="M3 12l9-9h8a1 1 0 0 1 1 1v8l-9 9-9-9z" />
    <circle cx="16" cy="8" r="1.3" />
  </Icon>
);
const MoreIcon = () => (
  <Icon>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </Icon>
);

export function AdminLayout() {
  const { profile, user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useAdminPwa();

  // Lets the toast messages sit above the phone's bottom tab bar (see index.css).
  useEffect(() => {
    document.body.classList.add("admin-shell");
    return () => document.body.classList.remove("admin-shell");
  }, []);

  // Close the account menu whenever the page changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const email = profile?.email || user?.email || "";
  const tab = pathname.startsWith("/admin/orders") ? "orders" : pathname.startsWith("/admin/products") ? "products" : "more";

  function handleSignOut() {
    setMenuOpen(false);
    if (confirm("Sign out karna hai?")) void signOut();
  }

  const tabClass = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
      active ? "text-rose-900" : "text-stone-500"
    }`;

  return (
    <div className="flex min-h-screen bg-stone-100">
      {/* ---------- Desktop sidebar (unchanged) ---------- */}
      <aside className="hidden w-60 flex-col border-r border-stone-200 bg-white p-4 md:flex">
        <p className="mb-6 font-serif text-xl font-bold text-rose-900">AARAAH Admin</p>
        <nav className="flex flex-1 flex-col gap-1">
          {adminLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-rose-900 text-white" : "text-stone-600 hover:bg-stone-100"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-stone-200 pt-4 text-xs text-stone-500">
          <p className="mb-2 truncate">{profile?.email}</p>
          <button onClick={() => signOut()} className="font-medium text-rose-900">
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-x-hidden">
        {/* ---------- Phone top bar ---------- */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[#7a1730] px-4 text-white md:hidden">
          <img src="/pwa-admin-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg bg-white" />
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{pageTitle(pathname)}</h1>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold uppercase"
          >
            {(email[0] || "A").toUpperCase()}
          </button>
          {menuOpen && (
            <>
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
              <div className="absolute right-3 top-[3.25rem] z-50 w-64 rounded-2xl bg-white p-3 text-stone-800 shadow-xl ring-1 ring-black/10">
                <p className="truncate px-1 text-xs text-stone-500">Signed in as</p>
                <p className="mb-3 truncate px-1 text-sm font-medium">{email}</p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white active:bg-rose-800"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </header>

        {/* ---------- Page ---------- */}
        <div className="p-4 pb-28 md:p-8">
          <Outlet />
        </div>
      </div>

      {/* ---------- Phone bottom tab bar ---------- */}
      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <NavLink to="/admin/orders" className={tabClass(tab === "orders")}>
          <OrdersIcon />
          Orders
        </NavLink>
        <NavLink to="/admin/products" className={tabClass(tab === "products")}>
          <ProductsIcon />
          Products
        </NavLink>
        <NavLink to="/admin/more" className={tabClass(tab === "more")}>
          <MoreIcon />
          More
        </NavLink>
      </nav>
    </div>
  );
}
