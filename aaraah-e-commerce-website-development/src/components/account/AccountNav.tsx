import { NavLink } from "react-router-dom";

const links = [
  { to: "/account", label: "Profile", end: true },
  { to: "/account/orders", label: "Orders" },
  { to: "/account/addresses", label: "Addresses" },
];

export function AccountNav() {
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-stone-200 pb-2">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              isActive ? "bg-rose-900 text-white" : "text-stone-600 hover:bg-stone-100"
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
