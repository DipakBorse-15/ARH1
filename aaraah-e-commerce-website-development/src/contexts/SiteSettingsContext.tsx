import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchSiteSettings } from "@/services/siteSettings";
import { applySiteFont } from "@/config/fonts";
import type { SiteSettings } from "@/types";

interface SiteSettingsContextValue {
  settings: SiteSettings | null;
  loading: boolean;
  refresh: () => void;
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
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
