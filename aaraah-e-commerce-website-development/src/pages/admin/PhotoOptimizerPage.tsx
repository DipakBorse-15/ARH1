import { useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { supabase, friendlyError } from "@/lib/supabase";
import { resizeImage } from "@/lib/imageResize";

interface Row {
  id: string;
  variant_id: string;
  storage_path: string;
  url: string;
  bytes?: number;
}

const BUCKET = "product-images";
// Shrinking (which replaces and deletes old photos) is switched off on purpose until the measured sizes
// have been reviewed. The page only measures, which downloads nothing.
const ENABLE_SHRINK = false;
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

/** Runs `fn` over `items` with at most `limit` running at once. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i]);
      }
    }),
  );
}

/**
 * One-time clean-up for old product photos that are still big. Step 1 only measures the files
 * (no download, so no Supabase traffic). Step 2 shrinks the big ones the same way a new upload is
 * shrunk (1600 px WebP), saves the smaller copy, points the product at it and removes the old file.
 * Nothing is touched unless the new copy is clearly smaller.
 */
export default function PhotoOptimizerPage() {
  const { show } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [limitKb, setLimitKb] = useState(500);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const all: Row[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from("product_images").select("id, variant_id, storage_path, url").order("id").range(from, from + 999);
          if (error) throw error;
          all.push(...((data || []) as Row[]));
          if (!data || data.length < 1000) break;
        }
        setRows(all);
      } catch (err) {
        show(friendlyError(err), "error");
        setRows([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function scan() {
    if (!rows) return;
    setScanning(true);
    setScanned(0);
    const next = rows.map((r) => ({ ...r, bytes: undefined as number | undefined }));
    await pool(next, 6, async (r) => {
      try {
        const res = await fetch(r.url, { method: "HEAD", cache: "no-store" });
        const len = Number(res.headers.get("content-length"));
        if (res.ok && Number.isFinite(len) && len > 0) r.bytes = len;
      } catch {
        /* leave unknown */
      }
      setScanned((n) => n + 1);
    });
    setRows(next);
    setScanning(false);
  }

  const measured = (rows || []).filter((r) => r.bytes != null);
  const big = measured.filter((r) => (r.bytes as number) > limitKb * 1024).sort((a, b) => (b.bytes as number) - (a.bytes as number));
  const total = measured.reduce((s, r) => s + (r.bytes as number), 0);
  const bigTotal = big.reduce((s, r) => s + (r.bytes as number), 0);

  async function optimise() {
    if (!big.length) return;
    setRunning(true);
    setDone(0);
    setFailed([]);
    setSaved(0);
    const list = [...big];
    await pool(list, 2, async (r) => {
      try {
        const res = await fetch(r.url, { cache: "no-store" });
        if (!res.ok) throw new Error(`photo download failed (${res.status})`);
        const blob = await res.blob();
        const original = new File([blob], "photo", { type: blob.type || "image/jpeg" });
        const small = await resizeImage(original, 1600);
        // Only replace when the new copy is clearly smaller (at least 15% saving).
        if (small === original || small.size > original.size * 0.85) throw new Error("already small enough, left as it is");
        const ext = small.name.split(".").pop() || "webp";
        const path = `${r.variant_id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(path, small, { upsert: false, cacheControl: "31536000" });
        if (up.error) throw up.error;
        const newUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        const upd = await supabase.from("product_images").update({ storage_path: path, url: newUrl }).eq("id", r.id);
        if (upd.error) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw upd.error;
        }
        await supabase.storage.from(BUCKET).remove([r.storage_path]);
        setSaved((s) => s + (original.size - small.size));
        setRows((prev) => (prev || []).map((x) => (x.id === r.id ? { ...x, storage_path: path, url: newUrl, bytes: small.size } : x)));
      } catch (err) {
        setFailed((f) => [...f, `${r.storage_path}: ${err instanceof Error ? err.message : friendlyError(err)}`]);
      } finally {
        setDone((n) => n + 1);
      }
    });
    setRunning(false);
    show("Photo optimise ho gayi", "success");
  }

  if (!rows) return <LoadingState />;

  return (
    <div>
      <SEO title="Photo Optimizer" canonicalPath="/admin/photo-optimizer" />
      <h1 className="mb-1 font-serif text-2xl font-semibold text-stone-900">Photo Optimizer</h1>
      <p className="mb-4 max-w-2xl text-sm text-stone-600">
        Purani badi product photos ko chhota karta hai (1600 px WebP, naye upload jaisa). Abhi ye sirf size naapta hai (koi download nahi, koi photo badalti ya delete nahi hoti).
        Total product photos: {rows.length}.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={scan} disabled={scanning || running || rows.length === 0} className="rounded-lg bg-rose-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {scanning ? `Naap raha hu… ${scanned}/${rows.length}` : "Step 1: Photos ka size naapo"}
        </button>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Isse badi photos chhoti karo:
          <select value={limitKb} onChange={(e) => setLimitKb(Number(e.target.value))} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
            <option value={300}>300 KB</option>
            <option value={500}>500 KB</option>
            <option value={800}>800 KB</option>
            <option value={1500}>1.5 MB</option>
          </select>
        </label>
      </div>

      {measured.length > 0 && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
          <p>
            Naapi gayi: <b>{measured.length}</b> photos, kul size <b>{mb(total)}</b>.
          </p>
          <p className="mt-1">
            {limitKb >= 1000 ? `${limitKb / 1024} MB` : `${limitKb} KB`} se badi: <b>{big.length}</b> photos ({mb(bigTotal)}).
          </p>
          {ENABLE_SHRINK && big.length > 0 && (
            <button onClick={optimise} disabled={running || scanning} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {running ? `Chhoti ho rahi hain… ${done}/${big.length}` : `Step 2: ${big.length} badi photos chhoti karo`}
            </button>
          )}
          {(running || done > 0) && (
            <p className="mt-2 text-emerald-700">
              Ab tak {mb(saved)} bacha.
            </p>
          )}
        </div>
      )}

      {failed.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="mb-1 font-semibold">{failed.length} photos waise hi chhodi gayi (inme koi nuksaan nahi hua):</p>
          <ul className="list-disc pl-5">
            {failed.slice(0, 30).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {big.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Photo</th>
                <th className="px-3 py-2">Size</th>
              </tr>
            </thead>
            <tbody>
              {big.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="px-3 py-2">
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-rose-900 underline">
                      {r.storage_path}
                    </a>
                  </td>
                  <td className="px-3 py-2">{kb(r.bytes as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
