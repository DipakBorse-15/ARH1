/**
 * Centralised, environment-driven site configuration.
 * Never hard-code deployment paths/domains elsewhere in the app — read them
 * from here so the codebase moves cleanly between local dev, GitHub Pages
 * project sites, and the aaraah.in custom domain.
 */
export const siteConfig = {
  name: import.meta.env.VITE_SITE_NAME || "AARAAH",
  tagline: "Timeless Indian Ethnic Wear",
  url: import.meta.env.VITE_SITE_URL || "https://aaraah.in",
  // basePath mirrors Vite's `base` so router basename & canonical URLs agree.
  basePath: import.meta.env.VITE_BASE_PATH || "/",
  currency: "INR",
  currencySymbol: "₹",
  supportEmail: "aaraah.in@gmail.com",
  supportPhone: "+91 98983 52989",
  // WhatsApp Business number for "Direct Purchase" (country code + number, digits only).
  whatsappNumber: "919898352989",
  // Manual UPI collection: customer scans this on the confirmation page,
  // admin marks the order "paid" by hand once the payment is seen. Set the
  // real values via VITE_UPI_ID / VITE_UPI_PAYEE_NAME before going live.
  upiId: import.meta.env.VITE_UPI_ID || "set-upi-id@bank",
  upiPayeeName: import.meta.env.VITE_UPI_PAYEE_NAME || "AARAAH",
  // true only when a real UPI ID has been configured (not the placeholder).
  upiConfigured: Boolean(import.meta.env.VITE_UPI_ID) && !String(import.meta.env.VITE_UPI_ID).startsWith("set-upi-id"),
  categories: [
    { name: "Sarees", slug: "sarees" },
    { name: "Kurties & Kurta Sets", slug: "kurties-kurta-sets" },
    { name: "Lehengas", slug: "lehengas" },
    { name: "Dupattas & Stoles", slug: "dupattas-stoles" },
    { name: "Bottomwear", slug: "bottomwear" },
    { name: "Blouses", slug: "blouses" },
  ],
  collections: [
    { name: "New Arrival", slug: "new-arrival" },
    { name: "Festive", slug: "festive" },
    { name: "Daily Wear", slug: "daily-wear" },
    { name: "Occasional", slug: "occasional" },
  ],
} as const;

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
