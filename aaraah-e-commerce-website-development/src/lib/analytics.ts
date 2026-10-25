// Google Analytics 4 + Meta (Facebook) Pixel, switched on ONLY when their IDs are set as environment
// variables (VITE_GA_ID = "G-XXXXXXXXXX", VITE_META_PIXEL_ID = "123456789012345"). No ID -> nothing is
// loaded and nothing is sent. The IDs live in the hosting settings (Vercel today), not in the code, so
// they move with the site to any other host.
//
// Never throws: analytics must not be able to break shopping.

type Fn = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Fn;
    fbq?: Fn & { callMethod?: Fn; queue?: unknown[]; loaded?: boolean; version?: string; push?: Fn };
    _fbq?: unknown;
  }
}

const GA_ID = (import.meta.env.VITE_GA_ID || "").trim();
const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID || "").trim();
let started = false;

export interface TrackItem {
  id: string; // SKU of the colour
  name: string;
  variant?: string | null; // colour
  price: number;
  quantity: number;
  category?: string | null;
}

/** Admin pages and private account pages are never tracked. */
export function isTrackablePath(path: string): boolean {
  return !/^\/(admin|account|login|register|forgot-password|reset-password)(\/|$)/.test(path);
}

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    /* analytics must never break the shop */
  }
}

export function initAnalytics() {
  if (started || typeof document === "undefined") return;
  started = true;
  safe(() => {
    if (GA_ID) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        // gtag.js needs the real `arguments` object, not an array
        // eslint-disable-next-line prefer-rest-params
        (window.dataLayer as unknown[]).push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", GA_ID, { send_page_view: false });
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
      document.head.appendChild(s);
    }
    if (PIXEL_ID) {
      if (!window.fbq) {
        const f = function (...args: unknown[]) {
          if (f.callMethod) f.callMethod(...args);
          else (f.queue as unknown[]).push(args);
        } as NonNullable<Window["fbq"]>;
        f.queue = [];
        f.loaded = true;
        f.version = "2.0";
        f.push = f;
        window.fbq = f;
        window._fbq = f;
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://connect.facebook.net/en_US/fbevents.js";
        document.head.appendChild(s);
      }
      window.fbq("init", PIXEL_ID);
    }
  });
}

export function trackPageView(path: string) {
  if (!isTrackablePath(path)) return;
  safe(() => {
    window.gtag?.("event", "page_view", {
      page_path: path,
      page_location: `${window.location.origin}${path}`,
      page_title: document.title,
    });
    window.fbq?.("track", "PageView");
  });
}

const gaItems = (items: TrackItem[]) =>
  items.map((i) => ({ item_id: i.id, item_name: i.name, item_variant: i.variant || undefined, item_category: i.category || undefined, price: i.price, quantity: i.quantity }));
const fbContents = (items: TrackItem[]) => items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price }));
const sum = (items: TrackItem[]) => items.reduce((t, i) => t + i.price * i.quantity, 0);

export function trackViewItem(item: TrackItem) {
  safe(() => {
    window.gtag?.("event", "view_item", { currency: "INR", value: item.price, items: gaItems([item]) });
    window.fbq?.("track", "ViewContent", { content_type: "product", content_ids: [item.id], content_name: item.name, value: item.price, currency: "INR" });
  });
}

export function trackAddToCart(item: TrackItem) {
  safe(() => {
    window.gtag?.("event", "add_to_cart", { currency: "INR", value: item.price * item.quantity, items: gaItems([item]) });
    window.fbq?.("track", "AddToCart", { content_type: "product", content_ids: [item.id], contents: fbContents([item]), value: item.price * item.quantity, currency: "INR" });
  });
}

export function trackBeginCheckout(items: TrackItem[]) {
  if (!items.length) return;
  safe(() => {
    window.gtag?.("event", "begin_checkout", { currency: "INR", value: sum(items), items: gaItems(items) });
    window.fbq?.("track", "InitiateCheckout", { content_type: "product", content_ids: items.map((i) => i.id), contents: fbContents(items), num_items: items.length, value: sum(items), currency: "INR" });
  });
}

/** Sent once per order, when the order is placed (the customer may still have to pay by UPI). */
export function trackPurchase(orderNumber: string, total: number, items: TrackItem[]) {
  safe(() => {
    const key = `aaraah_tracked_${orderNumber}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* storage blocked: may send twice on reload, acceptable */
    }
    window.gtag?.("event", "purchase", { transaction_id: orderNumber, currency: "INR", value: total, items: gaItems(items) });
    window.fbq?.("track", "Purchase", { content_type: "product", content_ids: items.map((i) => i.id), contents: fbContents(items), value: total, currency: "INR" });
  });
}
