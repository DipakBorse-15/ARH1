import { useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { fetchAllCategoriesAdmin, upsertCategory, deleteCategory } from "@/services/categories";
import { supabase, friendlyError } from "@/lib/supabase";
import type { Category } from "@/types";

const EMPTY: Partial<Category> = { name: "", slug: "", description: "", image: "", active: true };

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminCategoriesPage() {
  const { show } = useToast();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Category>>(EMPTY);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setItems(await fetchAllCategoriesAdmin());
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")}`;
      const { error } = await supabase.storage.from("category-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("category-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image: data.publicUrl }));
    } catch (err) {
      show(friendlyError(err, "Image upload failed."), "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsertCategory({ ...form, slug: form.slug || slugify(form.name || "") });
      setForm(EMPTY);
      show("Category saved", "success");
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCategory(id);
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  return (
    <div>
      <SEO title="Manage Categories" canonicalPath="/admin/categories" />
      <h1 className="mb-6 font-serif text-2xl font-semibold text-stone-900">Categories</h1>

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
        <div className="sm:col-span-2 flex items-center gap-3">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="text-sm" />
          {uploading && <span className="text-xs text-stone-400">Uploading…</span>}
          {form.image && <img src={form.image} alt="" className="h-10 w-10 rounded object-cover" />}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Active
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white">
            {form.id ? "Update category" : "Add category"}
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
                <th className="p-3">Name</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Active</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-stone-100">
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
