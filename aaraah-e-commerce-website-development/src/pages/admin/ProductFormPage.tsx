import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { fetchCategories } from "@/services/categories";
import { fetchCollections } from "@/services/collections";
import {
  fetchProductByIdAdmin,
  upsertProduct,
  upsertVariant,
  deleteVariant,
  addVariantImage,
  deleteVariantImage,
  uploadProductImage,
} from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import { formatINR } from "@/components/product/PriceDisplay";
import type { Category, Collection, Product, ProductVariant } from "@/types";

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const EMPTY_PRODUCT: Partial<Product> = {
  brand: "AARAAH",
  name: "",
  slug: "",
  description: "",
  bullet_points: [],
  category_id: null,
  collection_id: null,
  active: true,
};

const EMPTY_VARIANT = { color: "", color_hex: "#7a1730", sku: "", price: 0, sale_price: "", stock_quantity: 0 };

export default function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { show } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [product, setProduct] = useState<Partial<Product> & { id?: string }>(EMPTY_PRODUCT);
  const [bulletsText, setBulletsText] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [newVariant, setNewVariant] = useState(EMPTY_VARIANT);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    fetchCollections().then(setCollections).catch(() => {});
    if (!isNew && id) load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load(productId: string) {
    setLoading(true);
    try {
      const data = await fetchProductByIdAdmin(productId);
      if (data) {
        setProduct(data);
        setBulletsText((data.bullet_points || []).join("\n"));
        setVariants(data.variants);
      }
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<Product> = {
        ...product,
        slug: product.slug || slugify(product.name || ""),
        bullet_points: bulletsText.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      const saved = await upsertProduct(payload);
      show("Product saved", "success");
      if (isNew) {
        navigate(`/admin/products/${saved.id}`, { replace: true });
      } else {
        setProduct(saved);
      }
    } catch (err) {
      show(friendlyError(err, "Could not save product. Slug and SKU must be unique."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!product.id) return;
    try {
      await upsertVariant({
        product_id: product.id,
        color: newVariant.color,
        color_hex: newVariant.color_hex,
        sku: newVariant.sku,
        price: Number(newVariant.price),
        sale_price: newVariant.sale_price ? Number(newVariant.sale_price) : null,
        stock_quantity: Number(newVariant.stock_quantity),
        is_available: Number(newVariant.stock_quantity) > 0,
        active: true,
        sort_order: variants.length,
      });
      setNewVariant(EMPTY_VARIANT);
      show("Variant added", "success");
      load(product.id);
    } catch (err) {
      show(friendlyError(err, "Could not add variant. SKU must be unique."), "error");
    }
  }

  async function handleUpdateVariant(v: ProductVariant) {
    try {
      await upsertVariant(v);
      show("Variant updated", "success");
      if (product.id) load(product.id);
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  async function handleDeleteVariant(vid: string) {
    if (!confirm("Delete this variant?")) return;
    try {
      await deleteVariant(vid);
      if (product.id) load(product.id);
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  async function handleUploadImages(variantId: string, files: FileList) {
    try {
      for (const file of Array.from(files)) {
        const { path, url } = await uploadProductImage(file, variantId);
        await addVariantImage({ variant_id: variantId, storage_path: path, url, alt_text: product.name, sort_order: 0 });
      }
      show("Image(s) uploaded", "success");
      if (product.id) load(product.id);
    } catch (err) {
      show(friendlyError(err, "Image upload failed."), "error");
    }
  }

  async function handleDeleteImage(imageId: string) {
    try {
      await deleteVariantImage(imageId);
      if (product.id) load(product.id);
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-4xl">
      <SEO title={isNew ? "New Product" : "Edit Product"} canonicalPath="/admin/products" />
      <h1 className="mb-6 font-serif text-2xl font-semibold text-stone-900">{isNew ? "New Product Design" : "Edit Product Design"}</h1>

      <form onSubmit={handleSaveProduct} className="mb-10 grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <input
          placeholder="Brand"
          value={product.brand}
          onChange={(e) => setProduct({ ...product, brand: e.target.value })}
          className={inputClass}
        />
        <input
          placeholder="Design name (e.g. Saree Design A)"
          required
          value={product.name}
          onChange={(e) => setProduct({ ...product, name: e.target.value, slug: product.slug || slugify(e.target.value) })}
          className={inputClass}
        />
        <input placeholder="Slug" value={product.slug} onChange={(e) => setProduct({ ...product, slug: e.target.value })} className={inputClass} />
        <select
          value={product.category_id || ""}
          onChange={(e) => setProduct({ ...product, category_id: e.target.value || null })}
          className={inputClass}
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={product.collection_id || ""}
          onChange={(e) => setProduct({ ...product, collection_id: e.target.value || null })}
          className={inputClass}
        >
          <option value="">Select collection</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!product.active} onChange={(e) => setProduct({ ...product, active: e.target.checked })} />
          Published (visible to customers)
        </label>
        <textarea
          placeholder="Description"
          value={product.description ?? ""}
          onChange={(e) => setProduct({ ...product, description: e.target.value })}
          className={`${inputClass} sm:col-span-2`}
          rows={3}
        />
        <textarea
          placeholder="Bullet points — one per line (e.g. Pure silk fabric)"
          value={bulletsText}
          onChange={(e) => setBulletsText(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
          rows={4}
        />
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </button>
        </div>
      </form>

      {!isNew && product.id && (
        <section>
          <h2 className="mb-4 font-serif text-xl font-semibold text-stone-900">Variants ({variants.length})</h2>

          <div className="mb-6 space-y-4">
            {variants.map((v) => (
              <VariantCard key={v.id} variant={v} onUpdate={handleUpdateVariant} onDelete={handleDeleteVariant} onUpload={handleUploadImages} onDeleteImage={handleDeleteImage} />
            ))}
          </div>

          <form onSubmit={handleAddVariant} className="grid gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 sm:grid-cols-3">
            <p className="text-sm font-medium text-stone-700 sm:col-span-3">+ Add new colour variant</p>
            <input placeholder="Colour (e.g. Red)" required value={newVariant.color} onChange={(e) => setNewVariant({ ...newVariant, color: e.target.value })} className={inputClass} />
            <input type="color" value={newVariant.color_hex} onChange={(e) => setNewVariant({ ...newVariant, color_hex: e.target.value })} className="h-10 w-full rounded-lg border border-stone-300" />
            <input placeholder="SKU (unique)" required value={newVariant.sku} onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })} className={inputClass} />
            <input type="number" placeholder="Price" required value={newVariant.price} onChange={(e) => setNewVariant({ ...newVariant, price: Number(e.target.value) })} className={inputClass} />
            <input type="number" placeholder="Sale price (optional)" value={newVariant.sale_price} onChange={(e) => setNewVariant({ ...newVariant, sale_price: e.target.value })} className={inputClass} />
            <input type="number" placeholder="Stock quantity" required value={newVariant.stock_quantity} onChange={(e) => setNewVariant({ ...newVariant, stock_quantity: Number(e.target.value) })} className={inputClass} />
            <button type="submit" className="rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white sm:col-span-3 sm:w-fit">
              Add variant
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

function VariantCard({
  variant,
  onUpdate,
  onDelete,
  onUpload,
  onDeleteImage,
}: {
  variant: ProductVariant;
  onUpdate: (v: ProductVariant) => void;
  onDelete: (id: string) => void;
  onUpload: (variantId: string, files: FileList) => void;
  onDeleteImage: (imageId: string) => void;
}) {
  const [local, setLocal] = useState(variant);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: local.color_hex || "#ccc" }} />
          <p className="font-medium text-stone-900">
            {local.color} · {local.sku}
          </p>
        </div>
        <button onClick={() => onDelete(variant.id)} className="text-xs font-medium text-rose-700 hover:underline">
          Delete variant
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled label="Colour">
          <input value={local.color ?? ""} onChange={(e) => setLocal({ ...local, color: e.target.value })} className={inputClass} />
        </Labeled>
        <Labeled label="Colour hex">
          <input type="color" value={local.color_hex ?? "#7a1730"} onChange={(e) => setLocal({ ...local, color_hex: e.target.value })} className="h-10 w-full rounded-lg border border-stone-300" />
        </Labeled>
        <Labeled label="SKU">
          <input value={local.sku} onChange={(e) => setLocal({ ...local, sku: e.target.value })} className={inputClass} />
        </Labeled>
        <Labeled label="Price">
          <input type="number" value={local.price} onChange={(e) => setLocal({ ...local, price: Number(e.target.value) })} className={inputClass} />
        </Labeled>
        <Labeled label="Sale price">
          <input
            type="number"
            value={local.sale_price ?? ""}
            onChange={(e) => setLocal({ ...local, sale_price: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Stock">
          <input type="number" value={local.stock_quantity} onChange={(e) => setLocal({ ...local, stock_quantity: Number(e.target.value) })} className={inputClass} />
        </Labeled>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={local.is_available} onChange={(e) => setLocal({ ...local, is_available: e.target.checked })} />
          Available
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={local.active} onChange={(e) => setLocal({ ...local, active: e.target.checked })} />
          Active
        </label>
        <p className="text-stone-400">MRP preview: {formatINR(local.price)}</p>
      </div>

      <textarea
        placeholder="Variant-specific info (fabric care, fit notes, etc.)"
        value={local.variant_info ?? ""}
        onChange={(e) => setLocal({ ...local, variant_info: e.target.value })}
        className={`${inputClass} mt-3 w-full`}
        rows={2}
      />

      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => onUpdate(local)} className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-semibold text-white">
          Save variant
        </button>
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <p className="mb-2 text-xs font-medium text-stone-500">Images</p>
        <div className="flex flex-wrap gap-2">
          {(variant.images || []).map((img) => (
            <div key={img.id} className="group relative h-20 w-16 overflow-hidden rounded-lg border border-stone-200">
              <img src={img.url} alt={img.alt_text || ""} className="h-full w-full object-cover" />
              <button
                onClick={() => onDeleteImage(img.id)}
                className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
          <label className="flex h-20 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-400">
            + Add
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && onUpload(variant.id, e.target.files)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-500">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none";
