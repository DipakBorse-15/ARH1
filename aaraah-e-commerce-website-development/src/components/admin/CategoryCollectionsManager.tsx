import { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { supabase, friendlyError } from "@/lib/supabase";
import { fetchAllCollectionsAdmin } from "@/services/collections";
import {
  addCategoryCollection,
  fetchCategoryCollectionsAdmin,
  removeCategoryCollection,
  setCategoryCollectionPosition,
  updateCategoryCollectionImages,
} from "@/services/categoryCollections";
import { isSareeSlug } from "@/lib/categoryLinks";
import type { CategoryCollection, Collection } from "@/types";

/**
 * Admin → Categories → "Collections" for one category: which collections appear on that
 * category's page, in which position, and the web + mobile image each one uses there.
 */
export function CategoryCollectionsManager({ categoryId, categorySlug }: { categoryId: string; categorySlug: string }) {
  const { show } = useToast();
  const [rows, setRows] = useState<CategoryCollection[]>([]);
  const [all, setAll] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  async function load() {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([fetchCategoryCollectionsAdmin(categoryId), fetchAllCollectionsAdmin()]);
      setRows(r);
      setAll(c);
    } catch (err) {
      show(friendlyError(err, "Could not load. Run the 0024 SQL in Supabase first."), "error");
    } finally {
      setLoading(false);
    }
  }

  const available = all.filter((c) => !rows.some((r) => r.collection_id === c.id));

  async function add() {
    if (!pick) return;
    setBusy("add");
    try {
      await addCategoryCollection(categoryId, pick, rows.length + 1);
      setPick("");
      await load();
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: CategoryCollection) {
    if (!confirm(`Remove "${row.collection?.name}" from this category?`)) return;
    setBusy(row.id);
    try {
      await removeCategoryCollection(row.id);
      // Close the gap so positions stay 1..N.
      const rest = rows.filter((r) => r.id !== row.id);
      await Promise.all(rest.map((r, i) => setCategoryCollectionPosition(r.id, i + 1)));
      await load();
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const order = rows.map((r) => r.id);
    [order[index], order[target]] = [order[target], order[index]];
    setBusy("move");
    try {
      await Promise.all(order.map((id, i) => setCategoryCollectionPosition(id, i + 1)));
      await load();
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function upload(row: CategoryCollection, field: "image" | "mobile_image", file: File) {
    setBusy(`${row.id}:${field}`);
    try {
      const path = `cat-${categoryId.slice(0, 8)}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")}`;
      const { error } = await supabase.storage.from("collection-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("collection-images").getPublicUrl(path);
      await updateCategoryCollectionImages(row.id, { [field]: data.publicUrl });
      show("Image saved", "success");
      await load();
    } catch (err) {
      show(friendlyError(err, "Image upload failed."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function clearImage(row: CategoryCollection, field: "image" | "mobile_image") {
    setBusy(`${row.id}:${field}`);
    try {
      await updateCategoryCollectionImages(row.id, { [field]: null });
      await load();
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl bg-stone-50 p-4">
      {isSareeSlug(categorySlug) && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Note: the Sarees menu item opens the full list of saree products directly, so these collection tiles are not shown for Sarees.
        </p>
      )}
      <p className="mb-3 text-xs text-stone-500">
        Collections shown on this category's page, in order (1 = first). On the web, positions 1 and 4 are tall tiles (image 800 × 1250) and 2 and 3 are
        wide tiles (1000 × 630). On phones all tiles are the same (720 × 1050). A collection without products in this category shows "Coming Soon".
      </p>

      {loading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : (
        <>
          {rows.length === 0 && (
            <p className="mb-3 text-sm text-stone-500">
              Nothing set up yet — this category currently shows the collections that have products in it. Add collections below to control them.
            </p>
          )}

          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={row.id} className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="w-5 text-center text-sm font-semibold text-stone-700">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={busy !== null || i === 0}
                    className="rounded border border-stone-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                    aria-label="Move earlier"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={busy !== null || i === rows.length - 1}
                    className="rounded border border-stone-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                    aria-label="Move later"
                  >
                    ▼
                  </button>
                  <span className="text-sm font-medium text-stone-800">{row.collection?.name}</span>
                  {rows.length >= 4 && i < 4 && (
                    <span className="text-[10px] text-stone-400">(web: {i === 0 || i === 3 ? "tall" : "wide"} tile)</span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    disabled={busy !== null}
                    className="ml-auto text-xs text-stone-400 hover:text-rose-700 hover:underline disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(["image", "mobile_image"] as const).map((field) => (
                    <div key={field}>
                      <p className="mb-1 text-xs font-medium text-stone-600">{field === "image" ? "Web (laptop) image" : "Mobile image"}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          disabled={busy !== null}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) upload(row, field, f);
                            e.target.value = "";
                          }}
                          className="w-44 text-xs"
                        />
                        {busy === `${row.id}:${field}` && <span className="text-xs text-stone-400">Saving…</span>}
                        {row[field] && <img src={row[field] as string} alt="" className="h-12 w-10 rounded object-cover" />}
                        {row[field] && (
                          <button type="button" onClick={() => clearImage(row, field)} disabled={busy !== null} className="text-xs text-stone-500 underline">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            >
              <option value="">Add a collection…</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={add}
              disabled={!pick || busy !== null}
              className="rounded-full bg-rose-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
