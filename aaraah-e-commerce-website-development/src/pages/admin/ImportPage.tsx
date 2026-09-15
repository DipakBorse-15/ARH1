import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useToast } from "@/contexts/ToastContext";

/**
 * Bulk import from the AARAAH "Uploader.xlsx" template (see its Details sheet
 * for the full column-by-column spec). One row per SKU:
 *   - a "Parent" row groups colours together (its Item Name is the only one
 *     ever shown on the storefront; nothing else on the parent row is used)
 *   - a "Child" row is one purchasable colour, with its own images, price,
 *     bullets, description, etc.
 *
 * Columns are matched by their header text (row 1), not by position, so
 * reordering columns in the sheet won't break the import. A few headers
 * repeat (6x "Other Image URL", 5x "Bullet Point") — every occurrence is
 * read by its column position, left to right.
 */

interface ParsedVariant {
  sku: string;
  color: string;
  colorGroup: string;
  images: string[];
  description: string;
  bullets: string[];
  price: number; // MRP
  salePrice: number | null; // Selling Price
  discountPercent: number | null;
  discountAmount: number | null;
  stock: number;
  workType: string;
  workPattern: string;
  bestFor: string;
  manufacturer: string;
  includedComponents: string;
  fabricType: string;
  searchKeywords: string;
}

interface ParsedProduct {
  parentSku: string;
  name: string;
  productType: string;
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

function num(v: string | undefined): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** header text -> its column indices, in sheet order (handles repeated headers). */
function buildColumnIndex(headerRow: string[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  headerRow.forEach((h, i) => {
    const key = String(h ?? "").trim();
    if (!key) return;
    const list = index.get(key) || [];
    list.push(i);
    index.set(key, list);
  });
  return index;
}

function firstValue(arr: string[], colIndex: Map<string, number[]>, header: string): string {
  const pos = colIndex.get(header)?.[0];
  return pos == null ? "" : String(arr[pos] ?? "").trim();
}

function allValues(arr: string[], colIndex: Map<string, number[]>, header: string): string[] {
  const positions = colIndex.get(header) || [];
  return positions.map((pos) => String(arr[pos] ?? "").trim()).filter((v) => v !== "");
}

function parseWorkbook(wb: XLSX.WorkBook): ParsedProduct[] {
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "template") || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

  const headerRow = (grid[0] || []).map((h) => String(h ?? "").trim());
  const colIndex = buildColumnIndex(headerRow);

  const dataRows = grid.slice(1).filter((r) => (r || []).some((v) => String(v ?? "").trim() !== ""));

  const parentNames = new Map<string, string>(); // parent SKU -> Item Name
  const childRows: { sku: string; parentSku: string; arr: string[] }[] = [];

  for (const arr of dataRows) {
    const sku = firstValue(arr, colIndex, "SKU");
    if (!sku) continue;
    const level = firstValue(arr, colIndex, "Parentage Level").toLowerCase();
    const parentSku = firstValue(arr, colIndex, "Parent SKU");
    const itemName = firstValue(arr, colIndex, "Item Name");

    if (level === "parent") {
      parentNames.set(sku, itemName);
      continue;
    }
    childRows.push({ sku, parentSku: parentSku || sku, arr });
  }

  const childrenByParent = new Map<string, typeof childRows>();
  childRows.forEach((c) => {
    const list = childrenByParent.get(c.parentSku) || [];
    list.push(c);
    childrenByParent.set(c.parentSku, list);
  });

  const products: ParsedProduct[] = [];

  childrenByParent.forEach((children, parentSku) => {
    if (children.length === 0) return;
    const name = parentNames.get(parentSku) || firstValue(children[0].arr, colIndex, "Item Name");

    const variants: ParsedVariant[] = children.map(({ sku, arr }) => {
      const mainImg = firstValue(arr, colIndex, "Main Image URL");
      const otherImgs = allValues(arr, colIndex, "Other Image URL");
      const images = [mainImg, ...otherImgs].filter(Boolean);
      const bullets = allValues(arr, colIndex, "Bullet Point");

      const mrp = num(firstValue(arr, colIndex, "MRP")) ?? 0;
      const sellingPrice = num(firstValue(arr, colIndex, "Selling Price"));

      return {
        sku,
        color: firstValue(arr, colIndex, "Map Color") || firstValue(arr, colIndex, "Main Color"),
        colorGroup: firstValue(arr, colIndex, "Main Color"),
        images,
        description: firstValue(arr, colIndex, "Product Description"),
        bullets,
        price: mrp,
        salePrice: sellingPrice,
        discountPercent: num(firstValue(arr, colIndex, "Discount %")),
        discountAmount: num(firstValue(arr, colIndex, "Discount Amount")),
        stock: num(firstValue(arr, colIndex, "Stock")) ?? 0,
        workType: firstValue(arr, colIndex, "Work Type"),
        workPattern: firstValue(arr, colIndex, "Work Pattern"),
        bestFor: firstValue(arr, colIndex, "Best For"),
        manufacturer: firstValue(arr, colIndex, "Manufacturer"),
        includedComponents: firstValue(arr, colIndex, "Included Components"),
        fabricType: firstValue(arr, colIndex, "Fabric Type"),
        searchKeywords: firstValue(arr, colIndex, "Generic Keywords"),
      };
    });

    products.push({
      parentSku,
      name,
      productType: firstValue(children[0].arr, colIndex, "Product Type"),
      variants,
    });
  });

  return products;
}

/** Find or create a category matching the sheet's "Product Type" (e.g. "SAREE"). */
async function resolveCategoryId(productType: string): Promise<string | null> {
  const label = productType.trim();
  if (!label) return null;
  const niceName = label.charAt(0) + label.slice(1).toLowerCase(); // "SAREE" -> "Saree"
  const slug = slugify(niceName);

  const { data: existing } = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("categories")
    .insert({ name: niceName, slug, active: true })
    .select()
    .single();
  if (error) throw error;
  return created.id;
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
        show("No SKUs found — check the sheet matches the AARAAH template.", "error");
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
        const categoryId = await resolveCategoryId(p.productType);

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
              category_id: categoryId,
              active: true,
            })
            .select()
            .single();
          if (pErr) throw pErr;
          productId = created.id;
        }

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

          const { data: variant, error: vErr } = await supabase
            .from("product_variants")
            .upsert(
              {
                ...(priorVariant ? { id: priorVariant.id } : {}),
                product_id: productId,
                sku: v.sku,
                color: v.color,
                color_hex: hexFor(v.color),
                color_group: v.colorGroup,
                price: v.price,
                sale_price: v.salePrice,
                discount_percent: v.discountPercent,
                discount_amount: v.discountAmount,
                stock_quantity: v.stock,
                description: v.description,
                bullet_points: v.bullets,
                work_type: v.workType,
                work_pattern: v.workPattern,
                best_for: v.bestFor,
                manufacturer: v.manufacturer,
                included_components: v.includedComponents,
                fabric_type: v.fabricType,
                search_keywords: v.searchKeywords,
                sort_order: priorVariant ? i : offset + i,
              },
              { onConflict: "sku" }
            )
            .select()
            .single();
          if (vErr) throw vErr;

          priorVariant ? updated++ : added++;

          if (v.images.length > 0) {
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
        Upload the AARAAH listing sheet (Uploader.xlsx format). Parent rows group colours together; child
        rows become variants with their own images, price, description and bullet points.
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
                <p className="text-xs text-stone-400">
                  Parent SKU: {p.parentSku} · Type: {p.productType || "—"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.variants.map((v) => (
                    <div key={v.sku} className="w-24 rounded border border-stone-200 p-1">
                      {v.images[0] ? (
                        <img src={v.images[0]} alt={v.color} className="aspect-[3/4] w-full rounded object-cover" />
                      ) : (
                        <div className="aspect-[3/4] w-full rounded" style={{ backgroundColor: hexFor(v.color) }} />
                      )}
                      <p className="mt-1 truncate text-[10px] text-stone-600">{v.color}</p>
                      <p className="text-[10px] font-semibold text-stone-900">
                        ₹{v.salePrice ?? v.price} · {v.images.length} img
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
