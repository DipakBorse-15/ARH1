/** Link to a category's main page (banner, collections, latest launches). The old singular
 *  "saree" slug still maps to "sarees". */
export function categoryHref(slug: string): string {
  return `/category/${slug === "saree" ? "sarees" : slug}`;
}
