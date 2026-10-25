import { useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { StorefrontSections } from "@/components/home/StorefrontSections";
import { siteConfig, isSupabaseConfigured } from "@/config/site";
import { fetchActiveHeroSlides } from "@/services/heroSlides";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import type { HeroSlide } from "@/types";

export default function Home() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const { settings } = useSiteSettings();

  useEffect(() => {
    fetchActiveHeroSlides()
      .then(setSlides)
      .catch(() => {});
  }, []);

  return (
    <div>
      <SEO
        title={`${siteConfig.name} — Premium Indian Ethnic Wear`}
        description="Shop premium sarees, kurtis, kurta sets, lehengas, dupattas and more at AARAAH. Elegant, modern Indian ethnic wear with free shipping across India."
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${siteConfig.url}/#organization`,
              name: siteConfig.name,
              url: siteConfig.url,
              logo: settings?.logo_url || `${siteConfig.url}/icon-512.png`,
              email: siteConfig.supportEmail,
              telephone: siteConfig.supportPhone,
              sameAs: [siteConfig.social.instagram, siteConfig.social.facebook],
              address: { "@type": "PostalAddress", addressLocality: "Surat", addressRegion: "Gujarat", addressCountry: "IN" },
              contactPoint: {
                "@type": "ContactPoint",
                telephone: siteConfig.supportPhone,
                contactType: "customer service",
                areaServed: "IN",
                availableLanguage: ["English", "Hindi"],
              },
            },
            {
              "@type": "WebSite",
              "@id": `${siteConfig.url}/#website`,
              url: siteConfig.url,
              name: siteConfig.name,
              publisher: { "@id": `${siteConfig.url}/#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: `${siteConfig.url}/search?q={search_term_string}` },
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }}
      />

      {/* The page's one real heading for Google (the banner text is not it). Not visible. */}
      <h1 className="sr-only">{siteConfig.name} — Premium Indian Ethnic Wear</h1>

      <HeroCarousel slides={slides} />

      {!isSupabaseConfigured && (
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Supabase is not configured yet. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in your <code>.env</code> file, run the SQL migrations in{" "}
            <code>supabase/migrations</code>, then add products from the Admin panel to see live data here.
          </div>
        </div>
      )}

      {/* Collections → Latest launches → each collection's products.
          Shared with the category pages — edit StorefrontSections, not this file. */}
      <StorefrontSections />
    </div>
  );
}
