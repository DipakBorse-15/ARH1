import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/collections", label: "Collections" },
  { to: "/admin/orders", label: "Orders" },
];

export function AdminLayout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-stone-100">
      <aside className="hidden w-60 flex-col border-r border-stone-200 bg-white p-4 md:flex">
        <p className="mb-6 font-serif text-xl font-bold text-rose-900">AARAAH Admin</p>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((l) => (
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
      <div className="flex-1 overflow-x-hidden">
        <div className="border-b border-stone-200 bg-white p-4 md:hidden">
          <p className="font-serif text-lg font-bold text-rose-900">AARAAH Admin</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 text-xs font-medium ${isActive ? "bg-rose-900 text-white" : "bg-stone-100 text-stone-600"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
