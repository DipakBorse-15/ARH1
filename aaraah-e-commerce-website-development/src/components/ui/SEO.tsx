import { useEffect } from "react";
import { siteConfig } from "@/config/site";

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  canonicalPath?: string;
  jsonLd?: Record<string, unknown>;
  /** "product" for product pages; everything else is "website". */
  ogType?: "website" | "product";
}

// Pages that must never show up in Google (private, or no value for a searcher).
// Matched against canonicalPath, so no page needs to remember to ask for it.
const NOINDEX_PREFIXES = [
  "/admin",
  "/account",
  "/cart",
  "/checkout",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/order-confirmation",
  "/search",
  "/404",
];

function isNoIndex(path?: string): boolean {
  if (!path) return false;
  return NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** One line, at most ~160 characters (what Google shows), cut at a word end. */
function tidyDescription(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 160) return flat;
  const cut = flat.slice(0, 157);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, "")}…`;
}

/**
 * Lightweight document-head manager for a static SPA (no server rendering
 * available on GitHub Pages, so metadata is applied client-side on route
 * change — still fully crawlable for the JSON-LD / description use case and
 * correct for social shares triggered from within the app).
 */
export function SEO({ title, description, image, canonicalPath, jsonLd, ogType = "website" }: SEOProps) {
  // A new object is passed on every render; compare by content so the script tag is not re-added each time.
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : "";
  useEffect(() => {
    // Do not write "| AARAAH" twice when the title already carries the brand name.
    const fullTitle = title.toLowerCase().includes(siteConfig.name.toLowerCase()) ? title : `${title} | ${siteConfig.name}`;
    document.title = fullTitle;

    const desc = tidyDescription(description || siteConfig.tagline);
    // Pages without their own picture fall back to the logo, so a previous product's photo never sticks.
    const shareImage = image || `${siteConfig.url}/icon-512.png`;
    const pageUrl = `${siteConfig.url}${canonicalPath || ""}`;

    setMeta("description", desc);
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", desc, true);
    setMeta("og:image", shareImage, true);
    setMeta("og:url", pageUrl, true);
    setMeta("og:type", ogType, true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", desc);
    setMeta("twitter:image", shareImage);

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = pageUrl;

    // noindex for private / useless pages; removed again as soon as a normal page opens.
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (isNoIndex(canonicalPath)) {
      setMeta("robots", "noindex, nofollow");
    } else if (robots) {
      robots.remove();
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLdText) {
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.textContent = jsonLdText;
      document.head.appendChild(scriptEl);
    }

    return () => {
      if (scriptEl) document.head.removeChild(scriptEl);
    };
  }, [title, description, image, canonicalPath, jsonLdText, ogType]);

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
