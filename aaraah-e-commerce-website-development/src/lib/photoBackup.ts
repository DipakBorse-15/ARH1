import { supabase } from "@/lib/supabase";
import { buildZip, type ZipEntry } from "@/lib/zipStore";

interface Row {
  url: string;
  sort_order: number | null;
  variant: { sku: string | null } | { sku: string | null }[] | null;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "NO-SKU";

/** Downloads every product photo (full size) into one ZIP: folder per SKU, plus a photos-list.csv. */
export async function downloadPhotoBackup(onProgress: (done: number, total: number) => void): Promise<{ saved: number; failed: number }> {
  const rows: Row[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase
      .from("product_images")
      .select("url, sort_order, variant:product_variants(sku)")
      .order("variant_id")
      .order("sort_order")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  if (rows.length === 0) throw new Error("Koi photo nahi mili.");

  const entries: ZipEntry[] = [];
  const csv: string[] = ["sku,photo_number,file_in_zip,original_url"];
  const enc = new TextEncoder();
  let done = 0;
  let failed = 0;
  let next = 0;
  onProgress(0, rows.length);

  async function worker() {
    while (next < rows.length) {
      const i = next++;
      const r = rows[i];
      try {
        const res = await fetch(r.url);
        if (!res.ok) throw new Error(String(res.status));
        const buf = new Uint8Array(await res.arrayBuffer());
        const v = Array.isArray(r.variant) ? r.variant[0] : r.variant;
        const sku = safe(v?.sku || "NO-SKU");
        const ext = (r.url.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i)?.[1] || "jpg").toLowerCase();
        const name = `${sku}/${String((r.sort_order ?? 0) + 1).padStart(2, "0")}-${i}.${ext}`;
        entries.push({ name, data: buf });
        csv.push(`${sku},${(r.sort_order ?? 0) + 1},${name},${r.url}`);
      } catch {
        failed++;
      }
      done++;
      onProgress(done, rows.length);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);

  entries.push({ name: "photos-list.csv", data: enc.encode(csv.join("\n")) });
  const blob = buildZip(entries);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `aaraah-photos-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  return { saved: rows.length - failed, failed };
}
