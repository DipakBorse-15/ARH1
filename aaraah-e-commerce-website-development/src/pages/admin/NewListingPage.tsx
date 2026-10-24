import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { useToast } from "@/contexts/ToastContext";
import { fetchCategories } from "@/services/categories";
import { fetchCollections } from "@/services/collections";
import {
  addVariantImage,
  createParent,
  fetchLastVariantOf,
  fetchParentOptions,
  upsertVariant,
  uploadProductImage,
  type ParentOption,
} from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import { shortSlug } from "@/lib/slugs";
import { variantSeoDescription, variantSeoTitle } from "@/lib/seoText";
import type { Category, Collection } from "@/types";

const inputClass = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium text-stone-600";

type Step = "ask" | "parent" | "pick" | "child";

interface ChildForm {
  color: string;
  color_hex: string;
  color_group: string;
  sku: string;
  price: string;
  sale_price: string;
  stock_quantity: string;
  size: string;
  fabric_type: string;
  work_type: string;
  work_pattern: string;
  best_for: string;
  included_components: string;
  manufacturer: string;
  description: string;
  bullets: string;
  discount_percent: string;
  discount_amount: string;
  search_keywords: string;
  variant_info: string;
  collection_id: string;
}

const EMPTY_CHILD: ChildForm = {
  color: "",
  color_hex: "#7a1730",
  color_group: "",
  sku: "",
  price: "",
  sale_price: "",
  stock_quantity: "",
  size: "",
  fabric_type: "",
  work_type: "",
  work_pattern: "",
  best_for: "",
  included_components: "",
  manufacturer: "",
  description: "",
  bullets: "",
  discount_percent: "",
  discount_amount: "",
  search_keywords: "",
  variant_info: "",
  collection_id: "",
};

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function NewListingPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>("ask");
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [parent, setParent] = useState<ParentOption | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const [pName, setPName] = useState("");
  const [pSku, setPSku] = useState("");
  const [pCategory, setPCategory] = useState("");
  const [pCollection, setPCollection] = useState("");

  const [child, setChild] = useState<ChildForm>(EMPTY_CHILD);
  const [files, setFiles] = useState<File[]>([]);
  const [justAdded, setJustAdded] = useState<string[]>([]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    fetchCollections().then(setCollections).catch(() => {});
    reloadParents().then((list) => {
      // Coming back from the product page's own shortcut: /admin/products/new?parent=<id>
      const wanted = params.get("parent");
      const found = wanted ? list.find((p) => p.id === wanted) : null;
      if (found) {
        setParent(found);
        setStep("child");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reloadParents() {
    try {
      const list = await fetchParentOptions();
      setParents(list);
      return list;
    } catch (err) {
      show(friendlyError(err, "Could not load parents."), "error");
      return [];
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parents.slice(0, 60);
    return parents.filter((p) => `${p.name} ${p.parent_sku || ""}`.toLowerCase().includes(q)).slice(0, 60);
  }, [parents, query]);

  async function handleCreateParent(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim() || !pSku.trim()) {
      show("Parent ka naam aur Parent SKU zaroori hain", "error");
      return;
    }
    setSaving(true);
    try {
      const created = await createParent({
        name: pName.trim(),
        parent_sku: pSku.trim(),
        category_id: pCategory || null,
        collection_id: pCollection || null,
        brand: "AARAAH",
      });
      show("Parent ban gaya", "success");
      const option: ParentOption = {
        id: created.id,
        name: created.name,
        parent_sku: created.parent_sku,
        category_id: created.category_id,
        collection_id: created.collection_id,
        slug: created.slug,
        variants: [],
      };
      setParents((prev) => [option, ...prev]);
      setParent(option);
      setChild(EMPTY_CHILD);
      setStep("child");
    } catch (err) {
      show(friendlyError(err, "Parent nahi bana. Parent SKU pehle se kisi aur parent ka to nahi?"), "error");
    } finally {
      setSaving(false);
    }
  }

  function setC<K extends keyof ChildForm>(key: K, value: ChildForm[K]) {
    setChild((c) => ({ ...c, [key]: value }));
  }

  async function copyFromPrevious(p: ParentOption) {
    try {
      const last = await fetchLastVariantOf(p.id);
      if (!last) return;
      // Everything except what is different for every colour: colour, hex, SKU, stock, photos.
      setChild({
        ...EMPTY_CHILD,
        color_group: "",
        price: String(last.price ?? ""),
        sale_price: last.sale_price != null ? String(last.sale_price) : "",
        size: last.attributes?.size || "",
        fabric_type: last.fabric_type || "",
        work_type: last.work_type || "",
        work_pattern: last.work_pattern || "",
        best_for: last.best_for || "",
        included_components: last.included_components || "",
        manufacturer: last.manufacturer || "",
        description: last.description || "",
        bullets: (last.bullet_points || []).join("\n"),
        discount_percent: last.discount_percent != null ? String(last.discount_percent) : "",
        discount_amount: last.discount_amount != null ? String(last.discount_amount) : "",
        search_keywords: last.search_keywords || "",
        variant_info: last.variant_info || "",
        collection_id: last.collection_id || "",
      });
      setFiles([]);
      show("Pichle colour ki details bhar di (colour, hex, SKU, stock, photo chhodkar)", "success");
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  // Pre-fill from the previous colour as soon as a parent that already has colours is picked.
  async function chooseParent(p: ParentOption) {
    setParent(p);
    setChild(EMPTY_CHILD);
    setFiles([]);
    setJustAdded([]);
    setStep("child");
    if (p.variants.length > 0) await copyFromPrevious(p);
  }

  function validateChild(): string | null {
    if (!child.color.trim()) return "Colour likhna zaroori hai";
    if (!child.sku.trim()) return "SKU likhna zaroori hai";
    const price = Number(child.price);
    if (!Number.isFinite(price) || price <= 0) return "Price 0 se zyada hona chahiye";
    const sale = numOrNull(child.sale_price);
    if (sale !== null && (!Number.isFinite(sale) || sale <= 0 || sale > price)) return "Sale price price se zyada nahi ho sakta (ya khali chhodo)";
    const stock = Number(child.stock_quantity || 0);
    if (!Number.isInteger(stock) || stock < 0) return "Stock poori sankhya (0 ya zyada) honi chahiye";
    return null;
  }

  async function handleSaveChild(e: React.FormEvent, addAnother: boolean) {
    e.preventDefault();
    if (!parent) return;
    const problem = validateChild();
    if (problem) {
      show(problem, "error");
      return;
    }
    setSaving(true);
    try {
      const stock = Number(child.stock_quantity || 0);
      const saved = await upsertVariant({
        product_id: parent.id,
        color: child.color.trim(),
        color_hex: child.color_hex,
        color_group: child.color_group.trim() || null,
        sku: child.sku.trim(),
        price: Number(child.price),
        sale_price: numOrNull(child.sale_price),
        stock_quantity: stock,
        is_available: stock > 0,
        active: true,
        attributes: child.size.trim() ? { size: child.size.trim() } : {},
        fabric_type: child.fabric_type.trim() || null,
        work_type: child.work_type.trim() || null,
        work_pattern: child.work_pattern.trim() || null,
        best_for: child.best_for.trim() || null,
        included_components: child.included_components.trim() || null,
        manufacturer: child.manufacturer.trim() || null,
        description: child.description.trim() || null,
        bullet_points: child.bullets.split("\n").map((b) => b.trim()).filter(Boolean),
        discount_percent: numOrNull(child.discount_percent),
        discount_amount: numOrNull(child.discount_amount),
        search_keywords: child.search_keywords.trim() || null,
        variant_info: child.variant_info.trim() || null,
        collection_id: child.collection_id || null,
        sort_order: parent.variants.length,
      });
      let uploaded = 0;
      for (const file of files) {
        const { path, url } = await uploadProductImage(file, saved.id);
        await addVariantImage({ variant_id: saved.id, storage_path: path, url, alt_text: parent.name, sort_order: uploaded });
        uploaded += 1;
      }
      show(`${child.color} save ho gaya${uploaded ? ` (${uploaded} photo)` : ""}`, "success");
      const updated: ParentOption = { ...parent, variants: [...parent.variants, { id: saved.id, color: saved.color, sku: saved.sku }] };
      setParent(updated);
      setParents((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setJustAdded((a) => [...a, child.color.trim()]);
      if (addAnother) {
        await copyFromPrevious(updated);
        setChild((c) => ({ ...c, color: "", color_hex: "#7a1730", color_group: "", sku: "", stock_quantity: "" }));
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navigate(`/admin/products/${parent.id}?variant=${saved.id}`);
      }
    } catch (err) {
      show(friendlyError(err, "Save nahi hua. SKU pehle se kisi aur colour me to nahi?"), "error");
    } finally {
      setSaving(false);
    }
  }

  const preview = useMemo(() => {
    if (!parent || !child.color.trim()) return null;
    const category = categories.find((c) => c.id === parent.category_id);
    const product = { name: parent.name, category: category ? { name: category.name } : null };
    return { title: variantSeoTitle(product, child), description: variantSeoDescription(product, child) };
  }, [parent, child, categories]);

  return (
    <div className="mx-auto max-w-3xl">
      <SEO title="New listing" canonicalPath="/admin/products/new" />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-stone-900">New listing</h1>
        <Link to="/admin/products" className="text-sm text-stone-600 underline">
          ← Products
        </Link>
      </div>

      {step === "ask" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="mb-4 text-sm font-medium text-stone-800">Jo listing kar rahe ho wo kaunsi hai?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep("parent")}
              className="rounded-xl border border-stone-300 p-4 text-left hover:border-rose-900"
            >
              <span className="block font-semibold text-stone-900">Parent</span>
              <span className="text-xs text-stone-500">Sirf group banane ke liye. Site par nahi dikhta, photo nahi chahiye.</span>
            </button>
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="rounded-xl border border-stone-300 p-4 text-left hover:border-rose-900"
            >
              <span className="block font-semibold text-stone-900">Child (ek colour)</span>
              <span className="text-xs text-stone-500">Asli product: colour, price, stock, photo. Kisi parent ke andar jata hai.</span>
            </button>
          </div>
        </div>
      )}

      {step === "parent" && (
        <form onSubmit={handleCreateParent} className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-medium text-stone-800">Naya parent (sirf group)</p>
          <div className="sm:col-span-2">
            <label className={labelClass}>Parent name *</label>
            <input value={pName} onChange={(e) => setPName(e.target.value)} className={inputClass} placeholder="AARAAH Women's Georgette ... Saree with Unstitched Blouse Piece" />
          </div>
          <div>
            <label className={labelClass}>Parent SKU *</label>
            <input value={pSku} onChange={(e) => setPSku(e.target.value)} className={inputClass} placeholder="111S101-P" />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={pCategory} onChange={(e) => setPCategory(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Collection</label>
            <select value={pCollection} onChange={(e) => setPCollection(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Brand</label>
            <input value="AARAAH" disabled className={`${inputClass} bg-stone-50`} />
          </div>
          <p className="sm:col-span-2 text-xs text-stone-500">
            Web address apne aap banega: <span className="font-mono">{pName || pSku ? `/products/${previewSlug(pName, pSku)}` : "…"}</span>
          </p>
          <div className="sm:col-span-2 flex gap-3">
            <button disabled={saving} className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving…" : "Parent banao, phir colour jodo"}
            </button>
            <button type="button" onClick={() => setStep("ask")} className="text-sm text-stone-600 underline">
              Peeche
            </button>
          </div>
        </form>
      )}

      {step === "pick" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-stone-800">Ye colour kis parent ka hai?</p>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Parent ka naam ya SKU search karo"
            className={`${inputClass} mb-3`}
          />
          <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200">
            {shown.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => chooseParent(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-stone-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-stone-900">{p.name}</span>
                    <span className="text-xs text-stone-500">{p.parent_sku || "no parent SKU"}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{p.variants.length} colour</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-4 text-sm text-stone-500">Koi parent nahi mila.</li>}
          </ul>
          <div className="mt-4 flex items-center gap-4">
            <button type="button" onClick={() => setStep("parent")} className="rounded-full border border-rose-900 px-4 py-2 text-sm font-semibold text-rose-900">
              + Naya parent banao
            </button>
            <button type="button" onClick={() => setStep("ask")} className="text-sm text-stone-600 underline">
              Peeche
            </button>
          </div>
        </div>
      )}

      {step === "child" && parent && (
        <form onSubmit={(e) => handleSaveChild(e, false)} className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <p className="font-medium text-stone-900">{parent.name}</p>
            <p className="text-xs text-stone-500">
              Parent SKU: {parent.parent_sku || "—"} · {parent.variants.length} colour abhi tak
              {justAdded.length > 0 ? ` · is baar jode: ${justAdded.join(", ")}` : ""}
            </p>
            <button type="button" onClick={() => { setStep("pick"); setParent(null); }} className="mt-1 text-xs text-rose-900 underline">
              Parent badlo
            </button>
          </div>

          <section className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm font-semibold text-stone-800">Colour, SKU, price</p>
            <Field label="Colour *" value={child.color} onChange={(v) => setC("color", v)} placeholder="Royal Blue" />
            <div>
              <label className={labelClass}>Colour hex (swatch)</label>
              <input type="color" value={child.color_hex} onChange={(e) => setC("color_hex", e.target.value)} className="h-9 w-full rounded-lg border border-stone-300" />
            </div>
            <Field label="Main Color (color group)" value={child.color_group} onChange={(v) => setC("color_group", v)} placeholder="Blue" />
            <Field label="SKU *" value={child.sku} onChange={(v) => setC("sku", v)} placeholder="111S101-BLU" />
            <Field label="Price (₹) *" type="number" value={child.price} onChange={(v) => setC("price", v)} />
            <Field label="Sale price (₹)" type="number" value={child.sale_price} onChange={(v) => setC("sale_price", v)} />
            <Field label="Stock" type="number" value={child.stock_quantity} onChange={(v) => setC("stock_quantity", v)} />
            <Field label="Size" value={child.size} onChange={(v) => setC("size", v)} placeholder="Free Size" />
            <Field label="Discount %" type="number" value={child.discount_percent} onChange={(v) => setC("discount_percent", v)} />
            <Field label="Discount amount (₹)" type="number" value={child.discount_amount} onChange={(v) => setC("discount_amount", v)} />
          </section>

          <section className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm font-semibold text-stone-800">Details (yahi Google title/description banate hain)</p>
            <Field label="Fabric" value={child.fabric_type} onChange={(v) => setC("fabric_type", v)} placeholder="Georgette" />
            <Field label="Work type" value={child.work_type} onChange={(v) => setC("work_type", v)} placeholder="Embroidery" />
            <Field label="Work pattern" value={child.work_pattern} onChange={(v) => setC("work_pattern", v)} placeholder="Floral" />
            <Field label="Best for (occasion)" value={child.best_for} onChange={(v) => setC("best_for", v)} placeholder="Wedding" />
            <Field label="Included components" value={child.included_components} onChange={(v) => setC("included_components", v)} placeholder="Saree, Blouse Piece" />
            <Field label="Manufacturer" value={child.manufacturer} onChange={(v) => setC("manufacturer", v)} />
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea rows={4} value={child.description} onChange={(e) => setC("description", e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Bullet points (ek line = ek bullet)</label>
              <textarea rows={4} value={child.bullets} onChange={(e) => setC("bullets", e.target.value)} className={inputClass} />
            </div>
            <Field label="Search keywords" value={child.search_keywords} onChange={(v) => setC("search_keywords", v)} />
            <Field label="Variant info" value={child.variant_info} onChange={(v) => setC("variant_info", v)} />
            <div>
              <label className={labelClass}>Collection (khali = parent wali)</label>
              <select value={child.collection_id} onChange={(e) => setC("collection_id", e.target.value)} className={inputClass}>
                <option value="">— parent jaisi —</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <p className="mb-2 text-sm font-semibold text-stone-800">Photos</p>
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="text-sm" />
            {files.length > 0 && <p className="mt-1 text-xs text-stone-500">{files.length} photo chuni (pehli photo site par pehle dikhegi)</p>}
          </section>

          {preview && (
            <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">Google par aisa dikhega</p>
              <p className="text-blue-800">{preview.title} | AARAAH</p>
              <p className="text-stone-600">{preview.description}</p>
            </section>
          )}

          <div className="flex flex-wrap gap-3">
            <button disabled={saving} className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={(e) => handleSaveChild(e as unknown as React.FormEvent, true)}
              className="rounded-full border border-rose-900 px-5 py-2.5 text-sm font-semibold text-rose-900 disabled:opacity-60"
            >
              Save + aur ek colour jodo
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function previewSlug(name: string, sku: string) {
  return shortSlug(name, sku);
}


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} step={type === "number" ? "any" : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  );
}
