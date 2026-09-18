import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router doesn't reset scroll position on navigation (unlike a normal
 * multi-page site). Without this, clicking a product or "Buy Now" lands the
 * new page wherever the previous page happened to be scrolled to.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
