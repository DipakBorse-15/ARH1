import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { fetchSiteSettings, updateSiteSettings } from "@/services/siteSettings";
import { fetchAllCategoriesAdmin, upsertCategory } from "@/services/categories";
import { supabase, friendlyError } from "@/lib/supabase";
import type { Category, SiteSettings } from "@/types";

export default function AdminHomeEditorPage() {
  const { show } = useToast();
  const { refresh: refreshGlobalSettings } = useSiteSettings();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCategoryId, setUploadingCategoryId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [s, cats] = await Promise.all([fetchSiteSettings(), fetchAllCategoriesAdmin()]);
      setSettings(s);
      setCategories(cats);
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const path = `logo-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("site-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-images").getPublicUrl(path);
      setSettings((s) => (s ? { ...s, logo_url: data.publicUrl } : s));
    } catch (err) {
      show(friendlyError(err, "Logo upload failed."), "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await updateSiteSettings({
        logo_url: settings.logo_url,
        site_name: settings.site_name,
        tagline: settings.tagline,
        announcement_text: settings.announcement_text,
        announcement_link: settings.announcement_link,
        announcement_active: settings.announcement_active,
      });
      show("Homepage settings saved", "success");
      refreshGlobalSettings();
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleCategoryImageUpload(cat: Category, file: File) {
    setUploadingCategoryId(cat.id);
    try {
      const path = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("category-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("category-images").getPublicUrl(path);
      await upsertCategory({ id: cat.id, image: data.publicUrl });
      show(`${cat.name} thumbnail updated`, "success");
      load();
    } catch (err) {
      show(friendlyError(err, "Thumbnail upload failed."), "error");
    } finally {
      setUploadingCategoryId(null);
    }
  }

  if (loading || !settings) return <LoadingState label="Loading homepage settings…" />;

  return (
    <div>
      <SEO title="Home Page Editor" canonicalPath="/admin/home-editor" />
      <h1 className="mb-1 font-serif text-2xl font-semibold text-stone-900">Home Page Editor</h1>
      <p className="mb-6 text-sm text-stone-500">
        Logo, the offer strip, and category thumbnails shown across the site. For the rotating banner carousel,
        see <Link to="/admin/hero-slides" className="text-rose-900 underline">Banners</Link>.
      </p>

      {/* Logo & site name */}
      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Logo &amp; Site Name</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Logo image (leave empty to show text name)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-rose-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-rose-800"
            />
            {uploadingLogo && <p className="mt-1 text-xs text-stone-500">Uploading…</p>}
            {settings.logo_url && (
              <div className="mt-2 flex items-center gap-3">
                <img src={settings.logo_url} alt="Logo" className="h-10 w-auto rounded bg-stone-100 object-contain p-1" />
                <button
                  type="button"
                  onClick={() => setSettings((s) => (s ? { ...s, logo_url: null } : s))}
                  className="text-xs text-red-600 underline"
                >
                  Remove logo (use text name instead)
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Site name (shown if no logo image)</label>
            <input
              value={settings.site_name}
              onChange={(e) => setSettings((s) => (s ? { ...s, site_name: e.target.value } : s))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 mt-3 block text-xs font-medium text-stone-600">Tagline (optional, for future use)</label>
            <input
              value={settings.tagline || ""}
              onChange={(e) => setSettings((s) => (s ? { ...s, tagline: e.target.value } : s))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Announcement / offer bar */}
      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Offer Strip</h2>
        <p className="mb-3 text-xs text-stone-500">The thin banner shown at the very top of every page.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Offer text (e.g. Buy 2 Get 1 Free — Exclusive to Online Orders)"
            value={settings.announcement_text || ""}
            onChange={(e) => setSettings((s) => (s ? { ...s, announcement_text: e.target.value } : s))}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            placeholder="Link when clicked (optional, e.g. /collection/festive)"
            value={settings.announcement_link || ""}
            onChange={(e) => setSettings((s) => (s ? { ...s, announcement_link: e.target.value } : s))}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={settings.announcement_active}
              onChange={(e) => setSettings((s) => (s ? { ...s, announcement_active: e.target.checked } : s))}
            />
            Show offer strip on the site
          </label>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSaveSettings}
        disabled={savingSettings}
        className="mb-8 rounded-full bg-rose-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
      >
        {savingSettings ? "Saving…" : "Save Changes"}
      </button>

      {/* Category thumbnails */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-stone-900">Category Thumbnails</h2>
        <p className="mb-4 text-xs text-stone-500">
          These images power the round category shortcuts on the homepage. Add or edit categories fully on the{" "}
          <Link to="/admin/categories" className="text-rose-900 underline">Categories</Link> page.
        </p>
        <div className="flex flex-wrap gap-4">
          {categories.map((c) => (
            <div key={c.id} className="w-24 text-center">
              <div className="mx-auto mb-1 h-20 w-20 overflow-hidden rounded-full border border-stone-200 bg-stone-100">
                {c.image ? (
                  <img src={c.image} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-stone-300">🪷</div>
                )}
              </div>
              <p className="mb-1 truncate text-xs text-stone-700">{c.name}</p>
              <label className="cursor-pointer text-[10px] font-semibold text-rose-900 underline">
                {uploadingCategoryId === c.id ? "Uploading…" : "Change"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleCategoryImageUpload(c, e.target.files[0])}
                />
              </label>
            </div>
          ))}
          {categories.length === 0 && <p className="text-sm text-stone-500">No categories yet.</p>}
        </div>
      </section>
    </div>
  );
}
