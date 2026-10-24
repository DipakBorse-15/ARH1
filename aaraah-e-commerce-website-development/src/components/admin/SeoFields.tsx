import { siteConfig } from "@/config/site";

const TITLE_MAX = 60; // what Google shows before cutting
const DESC_MAX = 160;

/**
 * "How this page looks in Google" box for the admin forms. Both fields are optional:
 * left empty, the website uses the normal name / description (see SEO.tsx).
 * The counter for the title includes the " | AARAAH" the site adds by itself.
 */
export function SeoFields({
  title,
  description,
  onTitle,
  onDescription,
  fallbackTitle,
  fallbackDescription,
}: {
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  /** Shown in the preview while the field is empty (usually the product / category name and description). */
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  const shownTitleRaw = title.trim() || fallbackTitle.trim() || "Page title";
  const shownTitle = shownTitleRaw.toLowerCase().includes(siteConfig.name.toLowerCase()) ? shownTitleRaw : `${shownTitleRaw} | ${siteConfig.name}`;
  const shownDesc = (description.trim() || fallbackDescription.trim() || "Page description").replace(/\s+/g, " ");

  const titleLen = shownTitle.length;
  const descLen = description.trim().length;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 sm:col-span-2">
      <p className="text-sm font-semibold text-stone-800">Google search (SEO) — optional</p>
      <p className="mb-3 text-[11px] text-stone-500">
        Leave both empty and the website uses the name and description above. Fill them to control exactly what shows in Google.
      </p>

      <label className="mb-1 flex items-center justify-between text-xs font-medium text-stone-600">
        <span>SEO title</span>
        <span className={titleLen > TITLE_MAX ? "font-semibold text-rose-700" : "text-stone-400"}>
          {titleLen}/{TITLE_MAX} (with “| {siteConfig.name}”)
        </span>
      </label>
      <input
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder={fallbackTitle || "e.g. Teal Georgette Embroidered Saree with Blouse Piece"}
        maxLength={120}
        className="mb-3 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
      />

      <label className="mb-1 flex items-center justify-between text-xs font-medium text-stone-600">
        <span>SEO description</span>
        <span className={descLen > DESC_MAX ? "font-semibold text-rose-700" : "text-stone-400"}>
          {descLen}/{DESC_MAX}
        </span>
      </label>
      <textarea
        value={description}
        onChange={(e) => onDescription(e.target.value)}
        placeholder="1–2 lines: fabric, colour, occasion, free shipping across India."
        rows={3}
        maxLength={300}
        className="mb-3 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
      />

      <div className="rounded-lg border border-stone-200 bg-white p-3">
        <p className="mb-0.5 text-[11px] text-stone-400">Preview</p>
        <p className="truncate text-base text-blue-800">{shownTitle.slice(0, 70)}</p>
        <p className="text-xs text-emerald-800">{siteConfig.url.replace("https://", "")}</p>
        <p className="line-clamp-2 text-xs text-stone-600">{shownDesc.slice(0, 170)}</p>
      </div>
    </div>
  );
}
