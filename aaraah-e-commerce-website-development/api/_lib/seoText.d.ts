export const TITLE_CORE_MAX: number;
export const DESC_MAX: number;

export interface SeoProduct {
  name: string;
  category?: { name: string } | null;
}
export interface SeoVariant {
  color?: string | null;
  fabric_type?: string | null;
  work_type?: string | null;
  work_pattern?: string | null;
  best_for?: string | null;
  included_components?: string | null;
}

export function colorSlug(color: string | null | undefined): string;
export function shortSlug(name: string, parentSku?: string | null): string;
export function productTypeWord(productName: string, categoryName?: string | null): string;
export function variantSeoTitle(product: SeoProduct, variant: SeoVariant): string;
export function variantSeoDescription(product: SeoProduct, variant: SeoVariant): string;
export function missingSeoFields(variant: SeoVariant): string[];
export function categorySeoTitle(name: string): string;
export function collectionSeoTitle(name: string): string;
export function listingSeoDescription(name: string, description?: string | null): string;
