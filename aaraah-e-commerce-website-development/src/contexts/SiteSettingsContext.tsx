import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchSiteSettings } from "@/services/siteSettings";
import { applySiteFont } from "@/config/fonts";
import type { SiteSettings } from "@/types";

interface SiteSettingsContextValue {
  settings: SiteSettings | null;
  loading: boolean;
  refresh: () => void;
}

const FAVICON_KEY = "aaraah_favicon";

/** Browser-tab icon: use the uploaded site logo instead of the default lotus emoji. */
function applyFavicon(url: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.removeAttribute("type"); // the default one is declared as svg
  link.href = url;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | undefined>(undefined);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchSiteSettings()
      .then((s) => {
        setSettings(s);
        if (s?.font_family) applySiteFont(s.font_family);
        if (s?.logo_url) {
          applyFavicon(s.logo_url);
          try {
            localStorage.setItem(FAVICON_KEY, s.logo_url);
          } catch {
            /* private mode etc. — the icon just appears a moment later */
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Show the remembered logo as the tab icon straight away, before settings arrive.
    try {
      const saved = localStorage.getItem(FAVICON_KEY);
      if (saved) applyFavicon(saved);
    } catch {
      /* ignore */
    }
    load();
  }, [load]);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refresh: load }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  return ctx;
}
