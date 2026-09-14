import { useEffect } from "react";
import { siteConfig } from "@/config/site";

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  canonicalPath?: string;
  jsonLd?: Record<string, unknown>;
}

/**
 * Lightweight document-head manager for a static SPA (no server rendering
 * available on GitHub Pages, so metadata is applied client-side on route
 * change — still fully crawlable for the JSON-LD / description use case and
 * correct for social shares triggered from within the app).
 */
export function SEO({ title, description, image, canonicalPath, jsonLd }: SEOProps) {
  useEffect(() => {
    const fullTitle = `${title} | ${siteConfig.name}`;
    document.title = fullTitle;

    setMeta("description", description || siteConfig.tagline);
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", description || siteConfig.tagline, true);
    if (image) setMeta("og:image", image, true);

    const canonicalHref = `${siteConfig.url}${canonicalPath || ""}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonicalHref;

    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLd) {
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(scriptEl);
    }

    return () => {
      if (scriptEl) document.head.removeChild(scriptEl);
    };
  }, [title, description, image, canonicalPath, jsonLd]);

  return null;
}

function setMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}
