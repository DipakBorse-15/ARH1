import { useEffect } from "react";

/**
 * Makes the admin area installable as the "Aaraah Admin" phone app.
 *
 * The manifest link is added ONLY while an admin page is on screen and removed when you leave
 * (for example by opening the shop), so customers never see an "Install app" option on the
 * shop pages. The manifest's own scope is "/admin", so the phone app can only ever open admin pages.
 *
 * Files used (all in /public): pwa-admin-manifest.webmanifest, pwa-admin-sw.js,
 * pwa-admin-offline.html and the pwa-admin-*.png icons.
 */
const MANIFEST_HREF = "/pwa-admin-manifest.webmanifest";
const SW_URL = "/pwa-admin-sw.js";
const SW_SCOPE = "/admin";

export function useAdminPwa() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = MANIFEST_HREF;
    document.head.appendChild(link);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch(() => {
        /* The app still works without the service worker; only the offline page is lost. */
      });
    }

    return () => {
      link.remove();
    };
  }, []);
}
