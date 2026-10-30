/** Every admin page. Used by the desktop sidebar and by the phone "More" page. */
export interface AdminLink {
  to: string;
  label: string;
  end?: boolean;
}

export const adminLinks: AdminLink[] = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/home-editor", label: "Home Page" },
  { to: "/admin/import", label: "Import" },
  { to: "/admin/seo-check", label: "SEO Check" },
  { to: "/admin/photo-optimizer", label: "Photo Optimizer" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/collections", label: "Collections" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/coupons", label: "Coupons" },
  { to: "/admin/reviews", label: "Reviews" },
];

/**
 * Pages listed on the phone "More" page (Orders and Products have their own tabs).
 * Import, SEO Check and Photo Optimizer are laptop work, so they are not offered on the phone.
 */
export const moreLinks: AdminLink[] = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/home-editor", label: "Home Page" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/collections", label: "Collections" },
  { to: "/admin/coupons", label: "Coupons" },
  { to: "/admin/reviews", label: "Reviews" },
];
