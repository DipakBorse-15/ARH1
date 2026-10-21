import { useEffect, useState } from "react";
import { siteConfig, isSupabaseConfigured } from "@/config/site";
import { fetchCategoriesByRecentActivity } from "@/services/categories";
import { fetchCollections } from "@/services/collections";

export interface NavCategory {
  name: string;
  slug: string;
}

const FALLBACK: NavCategory[] = siteConfig.categories.map((c) => ({ name: c.name, slug: c.slug }));

// One fetch per page load, shared by Header and Footer (both mount together).
let cache: NavCategory[] | null = null;
let inflight: Promise<NavCategory[]> | null = null;

function loadOnce(): Promise<NavCategory[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchCategoriesByRecentActivity()
      .then((cats) => {
        const list = cats.map((c) => ({ name: c.name, slug: c.slug }));
        cache = list.length ? list : FALLBACK;
        return cache;
      })
      .catch(() => FALLBACK)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Active categories for the menu, ordered so the category with the most
 * recent product/colour launch comes first. Starts with the static list from
 * siteConfig so the menu never flashes empty, then swaps in the live order.
 */
export function useNavCategories(): NavCategory[] {
  const [cats, setCats] = useState<NavCategory[]>(cache || FALLBACK);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    loadOnce().then((list) => alive && setCats(list));
    return () => {
      alive = false;
    };
  }, []);
  return cats;
}

const COLLECTION_FALLBACK: NavCategory[] = siteConfig.collections.map((c) => ({ name: c.name, slug: c.slug }));
let collectionCache: NavCategory[] | null = null;

/** Collections for the menu, in the order and with the names set in Admin → Collections. */
export function useNavCollections(): NavCategory[] {
  const [cols, setCols] = useState<NavCategory[]>(collectionCache || COLLECTION_FALLBACK);
  useEffect(() => {
    if (!isSupabaseConfigured || collectionCache) return;
    let alive = true;
    fetchCollections()
      .then((list) => {
        const mapped = list.map((c) => ({ name: c.name, slug: c.slug }));
        collectionCache = mapped.length ? mapped : COLLECTION_FALLBACK;
        if (alive) setCols(collectionCache);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return cols;
}
