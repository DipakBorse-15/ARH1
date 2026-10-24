import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { fetchAllProductsPaged } from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import { missingSeoFields, variantSeoDescription, variantSeoTitle } from "@/lib/seoText";
import type { ProductWithVariants } from "@/types";

/**
 * Shows, for every active colour, which of the fields that build the Google title/description
 * are still empty, plus the title/description as they will appear. Nothing is saved here.
 */
export default function SeoCheckPage() {
  const { show } = useToast();
  const [products, setProducts] = useState<ProductWithVariants[] | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchAllProductsPaged().then(setProducts).catch((err) => {
      show(friendlyError(err), "error");
      setProducts([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const out = [];
    for (const p of products || []) {
      for (const v of p.variants.filter((x) => x.active)) {
        const missing = missingSeoFields(v);
        if (!p.category_id) missing.push("Parent ki Category");
        out.push({ p, v, missing, title: variantSeoTitle(p, v), description: variantSeoDescription(p, v) });
      }
    }
    return out;
  }, [products]);

  const emptyParents = useMemo(() => (products || []).filter((p) => p.variants.length === 0), [products]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!onlyMissing || r.missing.length > 0) && (!q || `${r.p.name} ${r.v.sku} ${r.v.color || ""}`.toLowerCase().includes(q)));
  }, [rows, onlyMissing, query]);

  if (!products) return <LoadingState />;
  const incomplete = rows.filter((r) => r.missing.length > 0).length;

  return (
    <div>
      <SEO title="SEO Check" canonicalPath="/admin/seo-check" />
      <h1 className="mb-1 font-serif text-2xl font-semibold text-stone-900">SEO Check</h1>
      <p className="mb-4 text-sm text-stone-600">
        {rows.length} colours me se {incomplete} me kuch fields khali hain. Khali field bharne par Google title/description apne aap behtar ho jata hai.
        {emptyParents.length > 0 ? ` ${emptyParents.length} parent abhi bina colour ke hain (ye site par nahi dikhte).` : ""}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Naam / SKU / colour" className="w-64 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Sirf jinme kuch khali hai
        </label>
        <span className="text-sm text-stone-500">{shown.length} dikh rahe</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Product / colour</th>
              <th className="px-3 py-2">Khali fields</th>
              <th className="px-3 py-2">Google title / description</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 align-top">
            {shown.slice(0, 300).map(({ p, v, missing, title, description }) => (
              <tr key={v.id}>
                <td className="px-3 py-2">
                  <p className="max-w-xs truncate font-medium text-stone-900">{p.name}</p>
                  <p className="text-xs text-stone-500">
                    {v.color || "(colour nahi)"} · {v.sku}
                  </p>
                </td>
                <td className="px-3 py-2 text-xs text-rose-800">{missing.length ? missing.join(", ") : <span className="text-emerald-700">Sab bhara hai</span>}</td>
                <td className="px-3 py-2 text-xs text-stone-700">
                  <p>
                    {title} | AARAAH <span className="text-stone-400">({title.length + 10})</span>
                  </p>
                  <p className="text-stone-500">
                    {description} <span className="text-stone-400">({description.length})</span>
                  </p>
                </td>
                <td className="px-3 py-2">
                  <Link to={`/admin/products/${p.id}?variant=${v.id}`} className="text-xs font-medium text-rose-900 underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-stone-500">
                  Kuch nahi mila.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.length > 300 && <p className="mt-2 text-xs text-stone-500">Pehle 300 dikh rahe hain; search se chhota karo.</p>}
    </div>
  );
}
