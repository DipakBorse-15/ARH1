import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { StorefrontSections } from "@/components/home/StorefrontSections";
import { fetchCategoryBySlug } from "@/services/categories";
import { fetchActiveHeroSlides } from "@/services/heroSlides";
import { friendlyError } from "@/lib/supabase";
import { siteConfig } from "@/config/site";
import type { Category, HeroSlide } from "@/types";

// Old category URLs (before the 6-category restructure) keep working.
const LEGACY_CATEGORY_SLUGS: Record<string, string> = {
  saree: "sarees",
  kurti: "kurties-kurta-sets",
  "kurta-set-with-dupatta": "kurties-kurta-sets",
};

/**
 * A category page has the SAME structure as the Home page:
 *   menu (categories) → hero banner → collections → latest → per-collection rows.
 * The part below the banner is the shared <StorefrontSections/> (also used by
 * Home), limited to this category. The product list with filters/sort now lives
 * at /category/<slug>/all ("View all products").
 */
export default function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState<Category | null>(null);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || LEGACY_CATEGORY_SLUGS[slug]) return;
    load(slug);
  }, [slug]);

  async function load(s: string) {
    setLoading(true);
    setError(null);
    try {
      const cat = await fetchCategoryBySlug(s);
      setCategory(cat);
      setSlides(cat ? await fetchActiveHeroSlides(cat.id) : []);
    } catch (err) {
      setError(friendlyError(err, "Could not load this page."));
    } finally {
      setLoading(false);
    }
  }

  if (slug && LEGACY_CATEGORY_SLUGS[slug]) return <Navigate to={`/category/${LEGACY_CATEGORY_SLUGS[slug]}`} replace />;
  if (loading) return <LoadingState label="Loading…" />;
  if (error) return <ErrorState message={error} onRetry={() => slug && load(slug)} />;
  if (!category) return <ErrorState message="This page could not be found." />;

  return (
    <div>
      <SEO
        title={category.name}
        description={category.description || `Shop ${category.name} at ${siteConfig.name}.`}
        canonicalPath={`/category/${category.slug}`}
      />

      {/* Same banner as the Home page unless this category has banners of its own. */}
      <HeroCarousel slides={slides} />

      <StorefrontSections category={{ id: category.id, slug: category.slug, name: category.name }} />

      <div className="mx-auto max-w-7xl px-4 pb-14 text-center sm:px-6">
        <Link
          to={`/category/${category.slug}/all`}
          className="inline-flex items-center gap-2 rounded-full border-2 border-rose-900 px-8 py-3 text-sm font-semibold text-rose-900 transition-all duration-300 hover:bg-rose-900 hover:text-white"
        >
          View all {category.name} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
