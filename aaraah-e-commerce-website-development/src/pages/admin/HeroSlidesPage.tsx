import { useEffect, useRef, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { fetchAllHeroSlidesAdmin, upsertHeroSlide, deleteHeroSlide } from "@/services/heroSlides";
import { supabase, friendlyError } from "@/lib/supabase";
import type { HeroSlide } from "@/types";

const EMPTY: Partial<HeroSlide> = {
  title: "",
  subtitle: "",
  image: "",
  cta_text: "",
  cta_link: "",
  active: true,
  sort_order: 0,
};

export default function AdminHeroSlidesPage() {
  const { show } = useToast();
  const [items, setItems] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<HeroSlide>>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setItems(await fetchAllHeroSlidesAdmin());
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("hero-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("hero-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image: data.publicUrl }));
    } catch (err) {
      show(friendlyError(err, "Image upload failed."), "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.image) {
      show("Title and image are required.", "error");
      return;
    }
    try {
      await upsertHeroSlide(form);
      setForm(EMPTY);
      show("Slide saved", "success");
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete the banner "${title}"? This can't be undone.`)) return;
    try {
      await deleteHeroSlide(id);
      show("Banner deleted", "success");
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  function editSlide(s: HeroSlide) {
    setForm(s);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    try {
      await Promise.all([
        upsertHeroSlide({ id: a.id, sort_order: b.sort_order }),
        upsertHeroSlide({ id: b.id, sort_order: a.sort_order }),
      ]);
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    }
  }

  return (
    <div>
      <SEO title="Manage Hero Slides" canonicalPath="/admin/hero-slides" />
      <h1 className="mb-1 font-serif text-2xl font-semibold text-stone-900">Homepage Banners</h1>
      <p className="mb-6 text-sm text-stone-500">
        These images and text power the rotating banner at the top of the homepage. Lower "Order" shows first.
      </p>

      <form ref={formRef} onSubmit={handleSave} className="mb-8 grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-sm font-semibold text-stone-900">
          {form.id ? "Edit Banner" : "Add a New Banner"}
        </h2>
        {form.id && (
          <div className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Editing "{form.title}" —{" "}
            <button type="button" className="underline" onClick={() => setForm(EMPTY)}>
              cancel and add a new one instead
            </button>
          </div>
        )}
        <input
          placeholder="Title (e.g. Rakhi Sale — Upto 65% Off)"
          value={form.title || ""}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          placeholder="Subtitle (optional)"
          value={form.subtitle || ""}
          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          placeholder="Button text (e.g. Shop Now) — optional"
          value={form.cta_text || ""}
          onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Button link (e.g. /category/saree) — optional"
          value={form.cta_link || ""}
          onChange={(e) => setForm((f) => ({ ...f, cta_link: e.target.value }))}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Order (0 shows first)"
          value={form.sort_order ?? 0}
          onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={form.active ?? true}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Active (shown on homepage)
        </label>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-stone-600">Banner image (wide, e.g. 1600×700)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-rose-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-rose-800"
          />
          {uploading && <p className="mt-1 text-xs text-stone-500">Uploading…</p>}
          {form.image && <img src={form.image} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />}
        </div>

        <button
          type="submit"
          className="sm:col-span-2 mt-1 rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-800"
        >
          {form.id ? "Save Changes" : "Save Banner"}
        </button>
      </form>

      {loading ? (
        <LoadingState label="Loading slides…" />
      ) : (
        <div className="space-y-3">
          {items.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveSlide(i, -1)}
                  disabled={i === 0}
                  title="Move up (shows earlier)"
                  className="rounded border border-stone-200 px-1.5 text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveSlide(i, 1)}
                  disabled={i === items.length - 1}
                  title="Move down (shows later)"
                  className="rounded border border-stone-200 px-1.5 text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <img src={s.image} alt={s.title} className="h-16 w-28 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">{s.title}</p>
                <p className="truncate text-xs text-stone-500">
                  Position {i + 1} of {items.length} · {s.active ? "Active" : "Hidden"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => editSlide(s)}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(s.id, s.title)}
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-stone-500">No banners yet — add your first one above.</p>}
        </div>
      )}
    </div>
  );
}
