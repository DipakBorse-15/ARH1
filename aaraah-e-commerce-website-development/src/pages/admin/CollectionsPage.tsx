import { useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { fetchAllCollectionsAdmin, upsertCollection, deleteCollection, setCollectionPosition } from "@/services/collections";
import { supabase, friendlyError } from "@/lib/supabase";
import type { Collection } from "@/types";

const EMPTY: Partial<Collection> = { name: "", slug: "", description: "", image: "", mobile_image: "", active: true };

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminCollectionsPage() {
  const { show } = useToast();
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Collection>>(EMPTY);
  const [uploading, setUploading] = useState<"image" | "mobile_image" | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setItems(await fetchAllCollectionsAdmin());
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File, field: "image" | "mobile_image") {
    setUploading(field);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")}`;
      const { error } = await supabase.storage.from("collection-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("collection-images").getPublicUrl(path);
      setForm((f) => ({ ...f, [field]: data.publicUrl }));
    } catch (err) {
      show(friendlyError(err, "Image upload failed."), "error");
    } finally {
      setUploading(null);
    }
  }

  // Swap this collection's position with its neighbour (dir -1 = earlier, +1 = later).
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    // Give everyone a clean 1..N position, then swap the two.
    const order = items.map((c) => c.id);
    [order[index], order[target]] = [order[target], order[index]];
    setMoving(true);
    try {
      await Promise.all(order.map((id, i) => setCollectionPosition(id, i + 1)));
      await load();
    } catch (err) {
      show(friendlyError(err, "Could not change the order. Run the 0023 SQL first."), "error");
    } finally {
      setMoving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const nextPosition = items.reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0) + 1;
      await upsertCollection({
        ...form,
        mobile_image: form.mobile_image || null,
        slug: form.slug || slugify(form.name || ""),
        sort_order: form.id ? form.sort_order : nextPosition,
      });
      setForm(EMPTY);
      show("Collection saved", "success");
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCollection(id);
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  return (
    <div>
      <SEO title="Manage Collections" canonicalPath="/admin/collections" />
      <h1 className="mb-2 font-serif text-2xl font-semibold text-stone-900">Collections</h1>
      <p className="mb-6 text-xs text-stone-500">
        Use ▲ ▼ to set the order on the website (1 = first). On the web, positions 1 and 4 are tall tiles and 2 and 3 are wide tiles; on phones all four
        are equal.
      </p>

      <form onSubmit={handleSave} className="mb-8 grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <input
          placeholder="Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })}
          className={inputClass}
        />
        <input placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inputClass} />
        <textarea
          placeholder="Description"
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={`${inputClass} sm:col-span-2`}
        />
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-stone-600">Web (laptop) image</p>
          <div className="flex items-center gap-3">
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "image")} className="text-sm" />
            {uploading === "image" && <span className="text-xs text-stone-400">Uploading…</span>}
            {form.image && <img src={form.image} alt="" className="h-10 w-10 rounded object-cover" />}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-stone-600">Mobile image (optional — phones show this instead of the web image)</p>
          <div className="flex items-center gap-3">
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "mobile_image")} className="text-sm" />
            {uploading === "mobile_image" && <span className="text-xs text-stone-400">Uploading…</span>}
            {form.mobile_image && <img src={form.mobile_image} alt="" className="h-10 w-10 rounded object-cover" />}
            {form.mobile_image && (
              <button type="button" onClick={() => setForm({ ...form, mobile_image: "" })} className="text-xs text-stone-500 underline">
                Remove
              </button>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Active
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white">
            {form.id ? "Update collection" : "Add collection"}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(EMPTY)} className="ml-2 text-sm text-stone-500">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="p-3">Position</th>
                <th className="p-3">Name</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Active</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => (
                <tr key={c.id} className="border-t border-stone-100">
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 text-center font-semibold text-stone-700">{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={moving || i === 0}
                        aria-label={`Move ${c.name} earlier`}
                        title="Move earlier"
                        className="rounded border border-stone-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={moving || i === items.length - 1}
                        aria-label={`Move ${c.name} later`}
                        title="Move later"
                        className="rounded border border-stone-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                    {items.length >= 4 && i < 4 && (
                      <p className="mt-0.5 text-[10px] text-stone-400">Web: {i === 0 || i === 3 ? "tall tile" : "wide tile"}</p>
                    )}
                  </td>
                  <td className="p-3 font-medium text-stone-800">{c.name}</td>
                  <td className="p-3 text-stone-500">{c.slug}</td>
                  <td className="p-3">{c.active ? "Yes" : "No"}</td>
                  <td className="p-3">
                    <button onClick={() => setForm(c)} className="mr-3 text-rose-900 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="text-stone-400 hover:text-rose-700 hover:underline">
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

const inputClass = "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none";
