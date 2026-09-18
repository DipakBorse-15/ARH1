import { useEffect, useRef, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { fetchSiteSettings, updateSiteSettings } from "@/services/siteSettings";
import { fetchAllHeroSlidesAdmin, upsertHeroSlide, deleteHeroSlide } from "@/services/heroSlides";
import { supabase, friendlyError } from "@/lib/supabase";
import { FONT_OPTIONS, applySiteFont } from "@/config/fonts";
import type { HeroSlide, SiteSettings } from "@/types";

type Tab = "branding" | "offer" | "banners";

/** Storage keys reject spaces/special characters — keep only safe ones. */
function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
}

const TABS: { id: Tab; label: string }[] = [
  { id: "branding", label: "Logo & Font" },
  { id: "offer", label: "Offer Strip" },
  { id: "banners", label: "Hero Banners" },
];

export default function AdminHomeEditorPage() {
  const [tab, setTab] = useState<Tab>("branding");

  return (
    <div>
      <SEO title="Home Page Editor" canonicalPath="/admin/home-editor" />
      <h1 className="mb-1 font-serif text-2xl font-semibold text-stone-900">Home Page Editor</h1>
      <p className="mb-6 text-sm text-stone-500">Everything that controls the look of your homepage, in one place.</p>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? "border-rose-900 text-rose-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "branding" && <BrandingTab />}
      {tab === "offer" && <OfferStripTab />}
      {tab === "banners" && <BannersTab />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared settings loader — Branding + Offer Strip both edit site_settings */
/* ---------------------------------------------------------------------- */

function useSettingsForm() {
  const { show } = useToast();
  const { refresh: refreshGlobal } = useSiteSettings();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchSiteSettings()
      .then(setSettings)
      .catch((err) => show(friendlyError(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(fields: Partial<SiteSettings>) {
    setSettings((s) => (s ? { ...s, ...fields } : s));
    setDirty(true);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSiteSettings({
        logo_url: settings.logo_url,
        site_name: settings.site_name,
        tagline: settings.tagline,
        font_family: settings.font_family,
        announcement_text: settings.announcement_text,
        announcement_link: settings.announcement_link,
        announcement_active: settings.announcement_active,
        announcement2_text: settings.announcement2_text,
        announcement2_link: settings.announcement2_link,
        announcement2_active: settings.announcement2_active,
      });
      setDirty(false);
      show("Saved", "success");
      refreshGlobal();
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return { settings, patch, loading, saving, dirty, save };
}

function SaveBar({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !dirty}
        className="rounded-full bg-rose-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
      {!saving && dirty && <span className="text-xs text-amber-700">You have unsaved changes</span>}
      {!saving && !dirty && <span className="text-xs text-stone-400">All changes saved</span>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Branding tab: logo, site name, tagline, font                           */
/* ---------------------------------------------------------------------- */

function BrandingTab() {
  const { show } = useToast();
  const { settings, patch, loading, saving, dirty, save } = useSettingsForm();
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const path = `logo-${Date.now()}-${safeFileName(file.name)}`;
      const { error } = await supabase.storage.from("site-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-images").getPublicUrl(path);
      patch({ logo_url: data.publicUrl });
    } catch (err) {
      show(friendlyError(err, "Logo upload failed."), "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  if (loading || !settings) return <LoadingState label="Loading…" />;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Logo &amp; Site Name</h2>
        <div className="grid gap-5 sm:grid-cols-2">
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
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-stone-50 p-2">
                <img src={settings.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
                <button type="button" onClick={() => patch({ logo_url: null })} className="text-xs text-red-600 underline">
                  Remove logo
                </button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Site name (shown if no logo image)</label>
              <input
                value={settings.site_name}
                onChange={(e) => patch({ site_name: e.target.value })}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Tagline (optional)</label>
              <input
                value={settings.tagline || ""}
                onChange={(e) => patch({ tagline: e.target.value })}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-stone-900">Font Style</h2>
        <p className="mb-3 text-xs text-stone-500">Changes the font used across the whole website.</p>
        <select
          value={settings.font_family}
          onChange={(e) => {
            patch({ font_family: e.target.value });
            applySiteFont(e.target.value); // live preview immediately, saved with the button below
          }}
          className="w-full max-w-sm rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="mt-3 text-lg text-stone-800" style={{ fontFamily: `"${settings.font_family}", sans-serif` }}>
          The quick brown fox jumps over the lazy dog — साड़ी, कुर्ती
        </p>
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Offer strip tab                                                        */
/* ---------------------------------------------------------------------- */

function OfferStripTab() {
  const { settings, patch, loading, saving, dirty, save } = useSettingsForm();
  if (loading || !settings) return <LoadingState label="Loading…" />;

  return (
    <div>
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-stone-900">Offer Strip</h2>
        <p className="mb-4 text-xs text-stone-500">The thin banner shown at the very top of every page on the site.</p>

        <label className="mb-4 flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={settings.announcement_active}
            onChange={(e) => patch({ announcement_active: e.target.checked })}
          />
          Show the offer strip on the site
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Offer text (e.g. Buy 2 Get 1 Free — Exclusive to Online Orders)"
            value={settings.announcement_text || ""}
            onChange={(e) => patch({ announcement_text: e.target.value })}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            placeholder="Link when clicked (optional, e.g. /collection/festive)"
            value={settings.announcement_link || ""}
            onChange={(e) => patch({ announcement_link: e.target.value })}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
          />
        </div>

        {settings.announcement_active && settings.announcement_text && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-stone-500">Preview</p>
            <div className="rounded-lg bg-stone-900 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
              {settings.announcement_text}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-stone-900">Second Offer Strip (optional)</h2>
        <p className="mb-4 text-xs text-stone-500">
          An extra, lighter-styled line shown just below the first one — handy for a second ongoing offer.
        </p>

        <label className="mb-4 flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={settings.announcement2_active}
            onChange={(e) => patch({ announcement2_active: e.target.checked })}
          />
          Show the second offer strip
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Offer text (e.g. Free shipping on orders above ₹999)"
            value={settings.announcement2_text || ""}
            onChange={(e) => patch({ announcement2_text: e.target.value })}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            placeholder="Link when clicked (optional)"
            value={settings.announcement2_link || ""}
            onChange={(e) => patch({ announcement2_link: e.target.value })}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
          />
        </div>

        {settings.announcement2_active && settings.announcement2_text && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-stone-500">Preview</p>
            <div className="rounded-lg bg-amber-50 px-4 py-2 text-center text-xs font-medium text-stone-800 sm:text-sm">
              {settings.announcement2_text}
            </div>
          </div>
        )}
      </section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Hero Banners tab (merged from the old standalone Banners page)         */
/* ---------------------------------------------------------------------- */

const EMPTY_SLIDE: Partial<HeroSlide> = {
  title: "",
  subtitle: "",
  image: "",
  cta_text: "",
  cta_link: "",
  active: true,
  sort_order: 0,
};

function BannersTab() {
  const { show } = useToast();
  const [items, setItems] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<HeroSlide>>(EMPTY_SLIDE);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

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
      const path = `${Date.now()}-${safeFileName(file.name)}`;
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
    if (!form.title?.trim()) {
      show("Please enter a title.", "error");
      return;
    }
    if (!form.image) {
      show("Please upload a banner image.", "error");
      return;
    }
    setSaving(true);
    try {
      await upsertHeroSlide(form);
      setForm(EMPTY_SLIDE);
      show(form.id ? "Banner updated" : "Banner added", "success");
      load();
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function editSlide(s: HeroSlide) {
    setForm(s);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <p className="mb-4 text-xs text-stone-500">
        The rotating banner carousel at the top of the homepage. Add 2 or more to enable auto-rotation with
        arrows; with one, it's a single static banner.
      </p>

      <div ref={formRef} className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">{form.id ? "Edit Banner" : "Add a New Banner"}</h2>
        <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
          {form.id && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
              Editing "{form.title}" —{" "}
              <button type="button" className="underline" onClick={() => setForm(EMPTY_SLIDE)}>
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
            placeholder="Button text (optional, e.g. Shop Now)"
            value={form.cta_text || ""}
            onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Button link (optional, e.g. /category/saree)"
            value={form.cta_link || ""}
            onChange={(e) => setForm((f) => ({ ...f, cta_link: e.target.value }))}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
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
            {form.image && <img src={form.image} alt="" className="mt-2 h-28 w-full rounded-lg object-cover" />}
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50 sm:col-span-2"
          >
            {saving ? "Saving…" : form.id ? "Save Changes" : "Save Banner"}
          </button>
        </form>
      </div>

      {loading ? (
        <LoadingState label="Loading banners…" />
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
