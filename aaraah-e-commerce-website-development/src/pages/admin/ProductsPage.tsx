import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { fetchAllProductsAdmin, upsertProduct, deleteProduct } from "@/services/products";
import { fetchAllCollectionsAdmin } from "@/services/collections";
import { friendlyError } from "@/lib/supabase";
import type { Collection, ProductWithVariants } from "@/types";

export default function AdminProductsPage() {
  const { show } = useToast();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCollectionId, setSavingCollectionId] = useState<string | null>(null);

  useEffect(() => {
    load();
    fetchAllCollectionsAdmin().then(setCollections).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      setProducts(await fetchAllProductsAdmin());
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await upsertProduct({ id, active: !active });
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  async function handleCollectionChange(productId: string, collectionId: string) {
    setSavingCollectionId(productId);
    try {
      await upsertProduct({ id: productId, collection_id: collectionId || null });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                collection_id: collectionId || null,
                collection: collections.find((c) => c.id === collectionId) || null,
              }
            : p
        )
      );
      show("Collection updated", "success");
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSavingCollectionId(null);
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
                <th className="p-3">Design</th>
                <th className="p-3">Category</th>
                <th className="p-3">Collection</th>
                <th className="p-3">Variants</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Active</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-stone-100">
                  <td className="p-3">
                    <p className="font-medium text-stone-800">{p.name}</p>
                    <p className="text-xs text-stone-400">{p.brand}</p>
                  </td>
                  <td className="p-3 text-stone-500">{p.category?.name || "—"}</td>
                  <td className="p-3">
                    <select
                      value={p.collection_id || ""}
                      disabled={savingCollectionId === p.id}
                      onChange={(e) => handleCollectionChange(p.id, e.target.value)}
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
                  <td className="p-3 text-stone-500">{p.variants.length}</td>
                  <td className="p-3 text-stone-500">{p.variants.reduce((s, v) => s + v.stock_quantity, 0)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(p.id, p.active)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
