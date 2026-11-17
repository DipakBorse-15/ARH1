/* Aaraah Admin service worker (Phase 1).
 *
 * Deliberately small and safe:
 *  - It only watches page opens (navigations) inside /admin. If the phone has no internet,
 *    it shows a simple "No internet" page instead of the browser's error.
 *  - It never stores pages, scripts, orders, prices or login data, so the app can never
 *    show you old data and a new site update is picked up on the next open.
 *  - Push alerts (new order, UTR, paid cancel, low stock) are shown by the "push" handler at the bottom.
 */
const OFFLINE_CACHE = "aaraah-admin-offline-v1";
const OFFLINE_URL = "/pwa-admin-offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("aaraah-admin-") && n !== OFFLINE_CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "AARAAH", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "AARAAH", {
      body: data.body || "",
      icon: "/pwa-admin-192.png",
      badge: "/favicon-48.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/admin/orders" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/orders";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (w.url.includes("/admin") && "focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return; // everything else goes straight to the network
  event.respondWith(
    fetch(req).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    })
  );
});
