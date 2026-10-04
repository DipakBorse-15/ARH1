import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import {
  fetchAllProductsAdmin,
  deleteProduct,
  updateProductQuick,
  updateVariantQuick,
  updateVariantsBulk,
} from "@/services/products";
import { fetchAllCollectionsAdmin } from "@/services/collections";
import { friendlyError } from "@/lib/supabase";
import type { Collection, ProductVariant, ProductWithVariants } from "@/types";

interface Draft {
  price: number;
  stock_quantity: number;
  collection_id: string | null;
}

export default function AdminProductsPage() {
  const { show } = useToast();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // --- SKU search / bulk quick-edit state ---
  const [skuQuery, setSkuQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [prods, cols] = await Promise.all([fetchAllProductsAdmin(), fetchAllCollectionsAdmin()]);
      setProducts(prods);
      setCollections(cols);
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function patchProduct(id: string, patch: Partial<ProductWithVariants>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function patchVariant(productId: string, variantId: string, patch: Partial<ProductVariant>) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id !== productId
          ? p
          : { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v)) }
      )
    );
  }

  async function toggleActive(id: string, active: boolean) {
    setSavingKey(`product:${id}`);
    try {
      await updateProductQuick(id, { active: !active });
      patchProduct(id, { active: !active });
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleProductCollectionChange(productId: string, collectionId: string) {
    setSavingKey(`product:${productId}`);
    try {
      await updateProductQuick(productId, { collection_id: collectionId || null });
      patchProduct(productId, {
        collection_id: collectionId || null,
        collection: collections.find((c) => c.id === collectionId) || null,
      });
      show("Collection updated", "success");
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleVariantCollectionChange(productId: string, variantId: string, collectionId: string) {
    setSavingKey(`variant:${variantId}`);
    try {
      await updateVariantQuick(variantId, { collection_id: collectionId || null });
      patchVariant(productId, variantId, {
        collection_id: collectionId || null,
        collection: collections.find((c) => c.id === collectionId) || null,
      });
      show("Collection updated", "success");
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleVariantSellingPriceCommit(productId: string, variant: ProductVariant, rawValue: string) {
    const nextSalePrice = Number(rawValue);
    if (!Number.isFinite(nextSalePrice) || nextSalePrice < 0) {
      show("Enter a valid selling price.", "error");
      return;
    }
    const currentEffective = variant.sale_price ?? variant.price;
    if (nextSalePrice === currentEffective) return; // unchanged, nothing to save

    setSavingKey(`variant:${variant.id}`);
    try {
      await updateVariantQuick(variant.id, { sale_price: nextSalePrice });
      patchVariant(productId, variant.id, { sale_price: nextSalePrice });
      show("Selling price updated", "success");
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this product design and all its variants?")) return;
    try {
      await deleteProduct(id);
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  // --- SKU search: flatten every variant across every design whose SKU
  // contains the query, regardless of which design it belongs to. ---
  const searchMatches = useMemo(() => {
    const q = skuQuery.trim().toLowerCase();
    if (!q) return [];
    const out: { product: ProductWithVariants; variant: ProductVariant }[] = [];
    for (const p of products) {
      for (const v of p.variants) {
        if (v.sku.toLowerCase().includes(q)) out.push({ product: p, variant: v });
      }
    }
    return out;
  }, [products, skuQuery]);

  // Seed a draft (once) for every newly-matched variant, without touching
  // drafts the admin is already mid-edit on.
  useEffect(() => {
    if (searchMatches.length === 0) return;
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { variant } of searchMatches) {
        if (!next[variant.id]) {
          next[variant.id] = {
            price: variant.sale_price ?? variant.price,
            stock_quantity: variant.stock_quantity,
            collection_id: variant.collection_id,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [searchMatches]);

  function updateDraft(variantId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [variantId]: { ...prev[variantId], ...patch } }));
  }

  function clearSearch() {
    setSkuQuery("");
    setDrafts({});
  }

  async function handleSaveAll() {
    type Edit = { id: string; patch: Partial<Pick<ProductVariant, "price" | "sale_price" | "collection_id" | "stock_quantity">> };
    const edits: Edit[] = [];
    for (const { variant } of searchMatches) {
      const d = drafts[variant.id];
      if (!d) continue;
      const changedPrice = d.price !== (variant.sale_price ?? variant.price);
      const changedStock = d.stock_quantity !== variant.stock_quantity;
      const changedCollection = d.collection_id !== variant.collection_id;
      if (!changedPrice && !changedStock && !changedCollection) continue;

      const patch: Edit["patch"] = {};
      if (changedPrice) patch.sale_price = d.price;
      if (changedStock) patch.stock_quantity = d.stock_quantity;
      if (changedCollection) patch.collection_id = d.collection_id;
      edits.push({ id: variant.id, patch });
    }

    if (edits.length === 0) {
      show("No changes to save.", "error");
      return;
    }

    setSavingAll(true);
    try {
      const { succeeded, failed } = await updateVariantsBulk(edits);
      if (succeeded.length > 0) show(`${succeeded.length} variant${succeeded.length > 1 ? "s" : ""} updated`, "success");
      if (failed.length > 0) show(`${failed.length} failed to save — check SKUs for conflicts`, "error");
      await load();
      setDrafts({});
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSavingAll(false);
    }
  }

  const isSearching = skuQuery.trim() !== "";
  const dirtyCount = searchMatches.filter(({ variant }) => {
    const d = drafts[variant.id];
    if (!d) return false;
    return (
      d.price !== (variant.sale_price ?? variant.price) ||
      d.stock_quantity !== variant.stock_quantity ||
      d.collection_id !== variant.collection_id
    );
  }).length;

  return (
    <div>
      <SEO title="Manage Products" canonicalPath="/admin/products" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold text-stone-900">Products</h1>
        <Link to="/admin/products/new" className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
          + New Product Design
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-sm flex-1">
          <input
            value={skuQuery}
            onChange={(e) => setSkuQuery(e.target.value)}
            placeholder="Search by SKU, e.g. 105S or 105S101…"
            className="w-full rounded-full border border-stone-300 py-2 pl-4 pr-9 text-sm focus:border-rose-900 focus:outline-none"
          />
          {isSearching && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              ✕
            </button>
          )}
        </div>
        {isSearching && (
          <>
            <span className="text-xs text-stone-500">
              {searchMatches.length} SKU{searchMatches.length !== 1 ? "s" : ""} matched
            </span>
            <button
              onClick={handleSaveAll}
              disabled={savingAll || dirtyCount === 0}
              className="ml-auto rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {savingAll ? "Saving…" : dirtyCount > 0 ? `Save All (${dirtyCount})` : "Save All"}
            </button>
          </>
        )}
      </div>

      {loading && <LoadingState />}
      {!loading && products.length === 0 && (
        <EmptyState title="No products yet" message="Create your first product design with color variants." />
      )}

      {!loading && products.length > 0 && isSearching && (
        <SearchResultsTable matches={searchMatches} drafts={drafts} collections={collections} onDraftChange={updateDraft} />
      )}

      {!loading && products.length > 0 && !isSearching && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="p-3">Design / Colour</th>
                <th className="p-3">Category</th>
                <th className="p-3">Collection</th>
                <th className="p-3">Selling Price</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Active</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isOpen = expanded.has(p.id);
                const totalStock = p.variants.reduce((s, v) => s + v.stock_quantity, 0);
                return (
                  <Fragment key={p.id}>
                    {/* ---- Parent (design) row ---- */}
                    <tr className="border-t border-stone-100">
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(p.id)}
                          className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded text-stone-500 hover:bg-stone-100"
                          aria-label={isOpen ? "Collapse variants" : "Expand variants"}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                        <span className="font-medium text-stone-800">{p.name}</span>
                        <p className="pl-7 text-xs text-stone-400">
                          {p.brand} · {p.variants.length} colour{p.variants.length !== 1 ? "s" : ""}
                        </p>
                      </td>
                      <td className="p-3 text-stone-500">{p.category?.name || "—"}</td>
                      <td className="p-3">
                        <select
                          value={p.collection_id || ""}
                          disabled={savingKey === `product:${p.id}`}
                          onChange={(e) => handleProductCollectionChange(p.id, e.target.value)}
                          className="rounded-lg border border-stone-300 px-2 py-1 text-xs focus:border-rose-900 focus:outline-none disabled:opacity-50"
                        >
                          <option value="">No collection</option>
                          {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-stone-400">—</td>
                      <td className="p-3 text-stone-500">{totalStock}</td>
                      <td className="p-3">
                        <button
                          onClick={() => toggleActive(p.id, p.active)}
                          disabled={savingKey === `product:${p.id}`}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                            p.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {p.active ? "Published" : "Unpublished"}
                        </button>
                      </td>
                      <td className="p-3">
                        <Link to={`/admin/products/${p.id}`} className="mr-3 text-rose-900 hover:underline">
                          Edit
                        </Link>
                        <button onClick={() => remove(p.id)} className="text-stone-400 hover:text-rose-700 hover:underline">
                          Delete
                        </button>
                      </td>
                    </tr>

                    {/* ---- Child (variant) rows ---- */}
                    {isOpen &&
                      p.variants.map((v) => (
                        <VariantRow
                          key={v.id}
                          product={p}
                          variant={v}
                          collections={collections}
                          saving={savingKey === `variant:${v.id}`}
                          onCollectionChange={(collectionId) => handleVariantCollectionChange(p.id, v.id, collectionId)}
                          onPriceCommit={(raw) => handleVariantSellingPriceCommit(p.id, v, raw)}
                          editHref={`/admin/products/${p.id}`}
                        />
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SKU search results: a flat, editable table across every design — type a
// SKU prefix like "105S" to pull up every colour of that design (105S101,
// 105S102, …) no matter which parent it's under, edit Price/Stock/Collection
// inline, then hit "Save All" once.
// ---------------------------------------------------------------------------
function SearchResultsTable({
  matches,
  drafts,
  collections,
  onDraftChange,
}: {
  matches: { product: ProductWithVariants; variant: ProductVariant }[];
  drafts: Record<string, Draft>;
  collections: Collection[];
  onDraftChange: (variantId: string, patch: Partial<Draft>) => void;
}) {
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
        No SKUs match that search — try a shorter prefix, like just the design number.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-50 text-xs uppercase text-stone-500">
          <tr>
            <th className="p-3">SKU / Colour</th>
            <th className="p-3">Design</th>
            <th className="p-3">Collection</th>
            <th className="p-3">Selling Price</th>
            <th className="p-3">Stock</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {matches.map(({ product, variant }) => {
            const draft = drafts[variant.id];
            if (!draft) return null;
            const inheritedCollection = collections.find((c) => c.id === product.collection_id);
            return (
              <tr key={variant.id} className="border-t border-stone-100">
                <td className="p-3">
                  <span className="inline-flex items-center gap-2">
                    {variant.color_hex && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-stone-300"
                        style={{ backgroundColor: variant.color_hex }}
                      />
                    )}
                    <span className="font-medium text-stone-800">{variant.sku}</span>
                  </span>
                  <p className="pl-5 text-xs text-stone-400">{variant.color}</p>
                </td>
                <td className="p-3 text-stone-500">{product.name}</td>
                <td className="p-3">
                  <select
                    value={draft.collection_id || ""}
                    onChange={(e) => onDraftChange(variant.id, { collection_id: e.target.value || null })}
                    className="rounded-lg border border-stone-300 px-2 py-1 text-xs focus:border-rose-900 focus:outline-none"
                  >
                    <option value="">{inheritedCollection ? `Inherit (${inheritedCollection.name})` : "Inherit (No collection)"}</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-stone-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.price}
                      onChange={(e) => onDraftChange(variant.id, { price: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-stone-300 px-2 py-1 text-xs focus:border-rose-900 focus:outline-none"
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-stone-400">MRP ₹{variant.price}</p>
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    value={draft.stock_quantity}
                    onChange={(e) => onDraftChange(variant.id, { stock_quantity: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-xs focus:border-rose-900 focus:outline-none"
                  />
                </td>
                <td className="p-3">
                  <Link to={`/admin/products/${product.id}`} className="text-rose-900 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VariantRow({
  product,
  variant,
  collections,
  saving,
  onCollectionChange,
  onPriceCommit,
  editHref,
}: {
  product: ProductWithVariants;
  variant: ProductVariant;
  collections: Collection[];
  saving: boolean;
  onCollectionChange: (collectionId: string) => void;
  onPriceCommit: (rawValue: string) => void;
  editHref: string;
}) {
  const effectiveSellingPrice = variant.sale_price ?? variant.price;
  const [priceDraft, setPriceDraft] = useState(String(effectiveSellingPrice));

  useEffect(() => {
    setPriceDraft(String(effectiveSellingPrice));
  }, [effectiveSellingPrice]);

  const inheritedCollection = collections.find((c) => c.id === product.collection_id);

  return (
    <tr className="border-t border-stone-50 bg-stone-50/60">
      <td className="p-3 pl-11 text-stone-700">
        <span className="inline-flex items-center gap-2">
          {variant.color_hex && (
            <span className="h-3 w-3 shrink-0 rounded-full border border-stone-300" style={{ backgroundColor: variant.color_hex }} />
          )}
          <span>{variant.color || "Variant"}</span>
          <span className="text-xs text-stone-400">· {variant.sku}</span>
        </span>
      </td>
      <td className="p-3 text-stone-300">—</td>
      <td className="p-3">
        <select
          value={variant.collection_id || ""}
          disabled={saving}
          onChange={(e) => onCollectionChange(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs focus:border-rose-900 focus:outline-none disabled:opacity-50"
        >
          <option value="">{inheritedCollection ? `Inherit (${inheritedCollection.name})` : "Inherit (No collection)"}</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-stone-400">₹</span>
          <input
            type="number"
            min={0}
            value={priceDraft}
            disabled={saving}
            onChange={(e) => setPriceDraft(e.target.value)}
            onBlur={(e) => onPriceCommit(e.target.value)}
            title="Selling price (what the customer pays)"
            className="w-20 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs focus:border-rose-900 focus:outline-none disabled:opacity-50"
          />
        </div>
        <p className="mt-0.5 text-[10px] text-stone-400">MRP ₹{variant.price}</p>
      </td>
      <td className="p-3 text-stone-500">{variant.stock_quantity}</td>
      <td className="p-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            variant.active && variant.is_available ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
          }`}
        >
          {variant.active ? (variant.is_available ? "Active" : "Out of stock") : "Inactive"}
        </span>
      </td>
      <td className="p-3">
        <Link to={editHref} className="text-rose-900 hover:underline">
          Edit
        </Link>
      </td>
    </tr>
  );
}
