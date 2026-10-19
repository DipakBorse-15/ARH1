import { Outlet, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";

/** Browsing pages (Home, category pages, collection pages) share the soft cream background used by
 *  the hero and "Top Collections" sections. Product, cart, checkout and account pages stay white. */
function usesCreamBackground(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/category/") || pathname.startsWith("/collection/");
}

export function MainLayout() {
  const { pathname } = useLocation();
  return (
    <div className={`flex min-h-screen flex-col text-stone-900 ${usesCreamBackground(pathname) ? "bg-amber-50" : "bg-white"}`}>
      <AnnouncementBar />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
