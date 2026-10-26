/* Aaraah Admin service worker (Phase 1).
 *
 * Deliberately small and safe:
 *  - It only watches page opens (navigations) inside /admin. If the phone has no internet,
 *    it shows a simple "No internet" page instead of the browser's error.
 *  - It never stores pages, scripts, orders, prices or login data, so the app can never
 *    show you old data and a new site update is picked up on the next open.
 *  - Phase 4 will add push notifications to this same file.
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
