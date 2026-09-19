import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import {
  fetchAllProductsAdmin,
  deleteProduct,
  updateProductQuick,
  updateVariantQuick,
  variantCollectionId,
} from "@/services/products";
import { fetchAllCollectionsAdmin } from "@/services/collections";
import { friendlyError } from "@/lib/supabase";
import type { Collection, ProductVariant, ProductWithVariants } from "@/types";

export default function AdminProductsPage() {
  const { show } = useToast();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

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

  return (
    <div>
      <SEO title="Manage Products" canonicalPath="/admin/products" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-stone-900">Products</h1>
        <Link to="/admin/products/new" className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
          + New Product Design
        </Link>
      </div>

      {loading && <LoadingState />}
      {!loading && products.length === 0 && (
        <EmptyState title="No products yet" message="Create your first product design with color variants." />
      )}

      {!loading && products.length > 0 && (
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
