import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useToast } from "@/contexts/ToastContext";

/**
 * Bulk import from an Amazon flat-file listing sheet.
 *
 * The sheet's row 5 holds Amazon's internal field keys (item_name[...], color[...],
 * bullet_point[...]#3.value, ...). We match on those key prefixes rather than on
 * column positions, so the importer keeps working when Amazon shifts columns around.
 */

type RawRow = Record<string, string>;

interface ParsedVariant {
  sku: string;
  color: string;
  colorHex: string;
  bullets: string[];
  images: string[];
  mrp: number;
  salePrice: number | null;
  stock: number;
  variantInfo: string;
}

interface ParsedProduct {
  parentSku: string;
  name: string;
  description: string;
  bullets: string[];
  variants: ParsedVariant[];
}

const COLOR_HEX: Record<string, string> = {
  black: "#000000", white: "#FFFFFF", red: "#C1272D", maroon: "#800000",
  pink: "#E75480", "rani pink": "#E3006D", peach: "#FFC8A2", orange: "#F28C28",
  mustard: "#D4A017", yellow: "#F2C14E", gold: "#D4AF37", cream: "#FFFDD0",
  beige: "#E8D3B0", brown: "#7B4B2A", green: "#2E7D32", "olive green": "#556B2F",
  "bottle green": "#006A4E", teal: "#008080", "sky blue": "#87CEEB", blue: "#1F4E9C",
  navy: "#1B264F", "navy blue": "#1B264F", purple: "#6A0DAD", lavender: "#B497D6",
  wine: "#722F37", grey: "#808080", gray: "#808080", silver: "#C0C0C0", magenta: "#C2185B",
};

function hexFor(color: string): string {
  return COLOR_HEX[color.trim().toLowerCase()] || "#999999";
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function num(v: string | undefined): number {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Pull the first value whose field key starts with any of the given prefixes. */
function pick(row: RawRow, ...prefixes: string[]): string {
  for (const p of prefixes) {
    for (const key of Object.keys(row)) {
      if (key.startsWith(p) && String(row[key] ?? "").trim() !== "") return String(row[key]).trim();
    }
  }
  return "";
}

/** Pull the first value whose field key contains all of the given fragments. */
function contains(row: RawRow, ...fragments: string[]): string {
  for (const key of Object.keys(row)) {
    if (fragments.every((f) => key.includes(f)) && String(row[key] ?? "").trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

function parseWorkbook(wb: XLSX.WorkBook): ParsedProduct[] {
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "template") || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

  // Row 5 (index 4) holds the field keys; data starts at row 6 (index 5).
  const keys = (grid[4] || []).map((k) => String(k ?? "").trim());
  const rows: RawRow[] = [];
  for (let r = 5; r < grid.length; r++) {
    const arr = grid[r] || [];
    const row: RawRow = {};
    let hasData = false;
    keys.forEach((k, i) => {
      const v = String(arr[i] ?? "").trim();
      if (k) row[k] = v;
      if (v) hasData = true;
    });
    if (hasData) rows.push(row);
  }

  const withSku = rows
    .map((row) => ({
      row,
      sku: pick(row, "contribution_sku", "item_sku"),
      parentSku: pick(row, "child_parent_sku_relationship"),
    }))
    .filter((r) => r.sku && r.sku.toUpperCase() !== "ABC123"); // drop Amazon's sample row

  // Children point at their parent's SKU. Rows nobody points at and that have a
  // parent of their own are treated as standalone products.
  const childrenByParent = new Map<string, typeof withSku>();
  const parentRows = new Map<string, RawRow>();

  withSku.forEach((r) => {
    if (r.parentSku) {
      const list = childrenByParent.get(r.parentSku) || [];
      list.push(r);
      childrenByParent.set(r.parentSku, list);
    } else {
      parentRows.set(r.sku, r.row);
    }
  });

  const products: ParsedProduct[] = [];

  childrenByParent.forEach((children, parentSku) => {
    const parentRow = parentRows.get(parentSku) || children[0].row;
    const first = children[0].row;

    const rawName = pick(parentRow, "item_name") || pick(first, "item_name");
    // Child titles carry a "(SKU_Colour)" suffix; the parent title is the clean one.
    const name = rawName.replace(/\s*\([^)]*\)\s*$/, "").trim();

    const variants: ParsedVariant[] = children.map((c) => {
      const row = c.row;
      const images: string[] = [];
      const main = pick(row, "main_product_image_locator");
      if (main) images.push(main);
      for (let i = 1; i <= 8; i++) {
        const u = pick(row, `other_product_image_locator_${i}`);
        if (u && !images.includes(u)) images.push(u);
      }

      const bullets: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const b = Object.keys(row).find((k) => k.startsWith("bullet_point") && k.includes(`#${i}.value`));
        const val = b ? String(row[b] ?? "").trim() : "";
        if (val) bullets.push(val);
      }

      // Amazon's `color` field is a standardised bucket (Teal -> "Turquoise", Peach ->
      // "Pink"). The real marketing colour sits in the child title's "(SKU_Colour)"
      // suffix, so prefer that and fall back to the standardised value.
      const titleSuffix = pick(row, "item_name").match(/\(([^)]*)\)\s*$/)?.[1] ?? "";
      const color = titleSuffix.includes("_")
        ? titleSuffix.slice(titleSuffix.indexOf("_") + 1).trim()
        : pick(row, "color");
      const mrp = num(contains(row, "maximum_retail_price"));
      const our = num(contains(row, "our_price"));
      const stock = num(contains(row, "fulfillment_availability", "quantity"));

      const listPrice = mrp || our;
      const sale = mrp && our && our < mrp ? our : null;

      return {
        sku: c.sku,
        color,
        colorHex: hexFor(color),
        bullets,
        images,
        mrp: listPrice,
        salePrice: sale,
        stock: stock || 0,
        variantInfo: bullets.find((b) => /colou?r\s*:/i.test(b)) || "",
      };
    });

    products.push({
      parentSku,
      name,
      description: pick(parentRow, "product_description") || pick(first, "product_description"),
      bullets: variants[0]?.bullets ?? [],
      variants,
    });
  });

  return products;
}

export default function ImportPage() {
  const { show } = useToast();
  const [parsed, setParsed] = useState<ParsedProduct[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  function addLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLog([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const products = parseWorkbook(wb);
      if (products.length === 0) {
        show("No parent/child listings found in this sheet.", "error");
      }
      setParsed(products);
    } catch (err) {
      show(friendlyError(err, "Could not read this file."), "error");
    }
  }

  async function handleImport() {
    if (parsed.length === 0) return;
    setBusy(true);
    setLog([]);

    for (const p of parsed) {
      try {
        // A product group is identified by its Amazon parent SKU. If a previous
        // import already created it, attach these colours to that same group
        // instead of creating a second product page.
        const { data: existing, error: findErr } = await supabase
          .from("products")
          .select("id, name")
          .eq("parent_sku", p.parentSku)
          .maybeSingle();
        if (findErr) throw findErr;

        let productId: string;

        if (existing) {
          productId = existing.id;
          addLog(`↳ ${existing.name} — existing group found (${p.parentSku})`);
        } else {
          const { data: created, error: pErr } = await supabase
            .from("products")
            .insert({
              brand: "AARAAH",
              parent_sku: p.parentSku,
              name: p.name,
              slug: `${slugify(p.name)}-${slugify(p.parentSku)}`,
              description: p.description,
              bullet_points: p.bullets,
              active: true,
            })
            .select()
            .single();
          if (pErr) throw pErr;
          productId = created.id;
        }

        // Continue the colour ordering after whatever is already in the group.
        const { count } = await supabase
          .from("product_variants")
          .select("id", { count: "exact", head: true })
          .eq("product_id", productId);
        const offset = count ?? 0;

        let added = 0;
        let updated = 0;

        for (const [i, v] of p.variants.entries()) {
          const { data: priorVariant } = await supabase
            .from("product_variants")
            .select("id")
            .eq("sku", v.sku)
            .maybeSingle();

          // Upserting on SKU keeps a re-run of the same sheet safe: colours are
          // refreshed in place rather than duplicated.
          const { data: variant, error: vErr } = await supabase
            .from("product_variants")
            .upsert(
              {
                ...(priorVariant ? { id: priorVariant.id } : {}),
                product_id: productId,
                sku: v.sku,
                color: v.color,
                color_hex: v.colorHex,
                price: v.mrp,
                sale_price: v.salePrice,
                stock_quantity: v.stock,
                variant_info: v.variantInfo,
                bullet_points: v.bullets,
                sort_order: priorVariant ? i : offset + i,
              },
              { onConflict: "sku" }
            )
            .select()
            .single();
          if (vErr) throw vErr;

          priorVariant ? updated++ : added++;

          if (v.images.length > 0) {
            // Replace the image set so a corrected sheet fixes the gallery.
            await supabase.from("product_images").delete().eq("variant_id", variant.id);
            const { error: iErr } = await supabase.from("product_images").insert(
              v.images.map((url, idx) => ({
                variant_id: variant.id,
                storage_path: url,
                url,
                alt_text: `${p.name} - ${v.color}`,
                sort_order: idx,
              }))
            );
            if (iErr) throw iErr;
          }
        }

        addLog(`✅ ${p.name} — ${added} new colour(s), ${updated} updated`);
      } catch (err) {
        addLog(`❌ ${p.parentSku}: ${friendlyError(err, "import failed")}`);
      }
    }

    setBusy(false);
    show("Import finished. Check the log below.", "success");
  }

  const totalVariants = parsed.reduce((n, p) => n + p.variants.length, 0);
  const totalImages = parsed.reduce((n, p) => n + p.variants.reduce((m, v) => m + v.images.length, 0), 0);

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-stone-900">Import from Excel</h1>
      <p className="mt-1 text-sm text-stone-500">
        Upload an Amazon flat-file listing sheet (.xlsx / .xlsm). Parent SKUs become products and child
        SKUs become colour variants, with their images and bullet points.
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-6">
        <input
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          onChange={handleFile}
          className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-rose-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-rose-800"
        />
        {fileName && <p className="mt-2 text-xs text-stone-500">Loaded: {fileName}</p>}
      </div>

      {parsed.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg bg-white p-4 shadow-sm">
            <span className="text-sm text-stone-700">
              <strong>{parsed.length}</strong> product(s) · <strong>{totalVariants}</strong> variants ·{" "}
              <strong>{totalImages}</strong> images
            </span>
            <button
              onClick={handleImport}
              disabled={busy}
              className="ml-auto rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-40"
            >
              {busy ? "Importing…" : "Import to store"}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {parsed.map((p) => (
              <div key={p.parentSku} className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-sm font-semibold text-stone-900">{p.name}</p>
                <p className="text-xs text-stone-400">Parent SKU: {p.parentSku}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.variants.map((v) => (
                    <div key={v.sku} className="w-24 rounded border border-stone-200 p-1">
                      {v.images[0] ? (
                        <img src={v.images[0]} alt={v.color} className="aspect-[3/4] w-full rounded object-cover" />
                      ) : (
                        <div className="aspect-[3/4] w-full rounded" style={{ backgroundColor: v.colorHex }} />
                      )}
                      <p className="mt-1 truncate text-[10px] text-stone-600">{v.color}</p>
                      <p className="text-[10px] font-semibold text-stone-900">
                        ₹{v.salePrice ?? v.mrp} · {v.images.length} img
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {log.length > 0 && (
        <div className="mt-6 rounded-lg bg-stone-900 p-4 font-mono text-xs text-stone-100">
          {log.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </div>
  );
}
