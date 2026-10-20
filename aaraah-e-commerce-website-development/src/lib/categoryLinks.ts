/**
 * The Sarees menu item has no landing page of its own: it opens the full list of
 * saree products. Every other category keeps its Home-style page.
 */
export function isSareeSlug(slug: string | undefined | null): boolean {
  return slug === "sarees" || slug === "saree";
}

export function categoryHref(slug: string): string {
  return isSareeSlug(slug) ? `/category/${slug === "saree" ? "sarees" : slug}/all` : `/category/${slug}`;
}
