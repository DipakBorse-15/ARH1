import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initAnalytics, trackPageView } from "@/lib/analytics";

/**
 * Starts analytics once and reports every page change (the site is a single-page app).
 * A page's real title is set a moment after the route changes (product pages load first),
 * so the report waits for the title to change, or at most 1.5 seconds. Renders nothing.
 */
export function Analytics() {
  const { pathname } = useLocation();
  useEffect(() => {
    initAnalytics();
  }, []);
  useEffect(() => {
    const before = document.title;
    let done = false;
    let observer: MutationObserver | null = null;
    const send = () => {
      if (done) return;
      done = true;
      observer?.disconnect();
      window.setTimeout(() => trackPageView(pathname), 50);
    };
    const timer = window.setTimeout(send, 1500);
    const titleEl = document.querySelector("title");
    if (titleEl && typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        if (document.title !== before) send();
      });
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    return () => {
      done = true;
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);
  return null;
}
