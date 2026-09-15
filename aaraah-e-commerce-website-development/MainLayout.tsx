import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-stone-900">
      <AnnouncementBar />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
