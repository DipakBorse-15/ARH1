import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { fetchAllProductsAdmin, upsertProduct, deleteProduct } from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import type { ProductWithVariants } from "@/types";

export default function AdminProductsPage() {
  const { show } = useToast();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
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
