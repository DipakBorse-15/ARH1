import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/contexts/ToastContext";
import { formatINR } from "@/components/product/PriceDisplay";
import {
  VariantSaveError,
  fetchVariantLight,
  fetchVariantsLight,
  saveVariantGuarded,
  type VariantRow,
} from "@/services/adminProducts";
import {
  LOW_STOCK_BELOW,
  checkDraft,
  draftFromRow,
  effectiveSelling,
  isDirty,
  previewPercentOff,
  type VariantDraft,
} from "@/lib/variantEdit";

type Filter = "all" | "low" | "out";

const SHOW_STEP = 40;
const STALE_MS = 45_000; // reload quietly when the app comes back after this long (new orders change stock)

const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 focus:border-rose-900 focus:outline-none disabled:bg-stone-50 disabled:text-stone-400";

/**
 * Phone "Products" tab: only MRP, selling price and stock of every colour, with a Save button on each card.
 * Nothing here can add, publish, unpublish or delete a product — that is laptop-only on purpose.
 */
export default function MobileProductsPage() {
  const { show } = useToast();
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(SHOW_STEP);

  const [drafts, setDrafts] = useState<Record<string, VariantDraft>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  const savingRef = useRef<Set<string>>(new Set()); // blocks a second tap before React re-renders
  const loadedAt = useRef(0);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchVariantsLight();
      setRows(data);
      loadedAt.current = Date.now();
      setError(null);
    } catch {
      if (!quiet) setError("Products load nahi ho paye. Internet check karke dobara try karo.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Coming back to the app after a while: refresh quietly, but never while you are in the middle of editing.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (Object.keys(draftsRef.current).length > 0) return;
      if (Date.now() - loadedAt.current < STALE_MS) return;
      void load(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // A new search or filter starts again from the first cards.
  useEffect(() => {
    setLimit(SHOW_STEP);
  }, [query, filter]);

  const counts = useMemo(() => {
    let low = 0;
    let out = 0;
    for (const r of rows) {
      if (!r.active) continue;
      if (r.stock_quantity < LOW_STOCK_BELOW) low++;
      if (r.stock_quantity === 0) out++;
    }
    return { all: rows.length, low, out };
  }, [rows]);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (filter === "low" && !(r.active && r.stock_quantity < LOW_STOCK_BELOW)) return false;
      if (filter === "out" && !(r.active && r.stock_quantity === 0)) return false;
      if (words.length === 0) return true;
      const hay = `${r.sku} ${r.product?.name ?? ""} ${r.color ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [rows, query, filter]);

  const dirtyCount = useMemo(
    () => rows.filter((r) => drafts[r.id] && isDirty(r, drafts[r.id])).length,
    [rows, drafts]
  );

  function setDraft(row: VariantRow, patch: Partial<VariantDraft>) {
    setDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? draftFromRow(row)), ...patch } }));
    setNotes((prev) => {
      if (!prev[row.id]) return prev;
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
  }

  function resetDraft(id: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setNotes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function save(row: VariantRow) {
    const draft = drafts[row.id];
    if (!draft || savingRef.current.has(row.id)) return;
    const check = checkDraft(row, draft);
    if (!check.ok) {
      if (!check.unchanged) setNotes((p) => ({ ...p, [row.id]: check.message }));
      return;
    }

    savingRef.current.add(row.id);
    setBusyIds((p) => new Set(p).add(row.id));
    try {
      const result = await saveVariantGuarded(row, check);
      if (result.kind === "saved") {
        setRows((prev) => prev.map((r) => (r.id === row.id ? result.row : r)));
        resetDraft(row.id);
        setSavedId(row.id);
        window.setTimeout(() => setSavedId((cur) => (cur === row.id ? null : cur)), 2500);
      } else {
        // Someone/something changed this colour a moment ago (e.g. a new order took stock): save nothing,
        // show the fresh numbers and let the owner decide again.
        const fresh = await fetchVariantLight(row.id).catch(() => null);
        if (fresh) setRows((prev) => prev.map((r) => (r.id === row.id ? fresh : r)));
        setNotes((p) => ({
          ...p,
          [row.id]:
            "Is colour mein abhi hi badlav ho gaya (shayad naya order aaya). Naya data dikha diya hai. Dekhkar dobara Save karo.",
        }));
      }
    } catch (err) {
      const message = err instanceof VariantSaveError ? err.message : "Save nahi ho paya. Dobara try karo.";
      setNotes((p) => ({ ...p, [row.id]: message }));
      show(message, "error");
    } finally {
      savingRef.current.delete(row.id);
      setBusyIds((p) => {
        const next = new Set(p);
        next.delete(row.id);
        return next;
      });
    }
  }

  function refresh() {
    if (dirtyCount > 0 && !confirm(`${dirtyCount} badlav abhi save nahi hue. Refresh karne par ye mit jayenge. Refresh karein?`)) return;
    setDrafts({});
    setNotes({});
    void load();
  }

  const shown = filtered.slice(0, limit);
  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "low", label: `Low stock (${LOW_STOCK_BELOW} se kam)`, count: counts.low },
    { key: "out", label: "Out of stock", count: counts.out },
  ];

  return (
    <div className="min-w-0">
      <SEO title="Products" canonicalPath="/admin/products" />

      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SKU ya design ka naam"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Search products"
            className="w-full rounded-full border border-stone-300 bg-white py-3 pl-4 pr-10 text-base focus:border-rose-900 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 px-1 text-stone-400"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-rose-900 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              filter === c.key ? "bg-rose-900 text-white" : "border border-stone-300 bg-white text-stone-600"
            }`}
          >
            {c.label} · {c.count}
          </button>
        ))}
      </div>

      {loading && <LoadingState label="Products load ho rahe hain…" />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState title="Abhi koi product nahi hai" message="Naya product laptop se add hota hai." />
      )}
      {!loading && !error && rows.length > 0 && filtered.length === 0 && (
        <EmptyState title="Kuch nahi mila" message="Search ya filter badal kar dekho." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <p className="mb-2 text-xs text-stone-500">
            {filtered.length} colour{filtered.length === 1 ? "" : "s"}
            {dirtyCount > 0 ? ` · ${dirtyCount} save baaki` : ""}
          </p>
          <ul className="space-y-3">
            {shown.map((row) => (
              <li key={row.id}>
                <VariantCard
                  row={row}
                  draft={drafts[row.id]}
                  busy={busyIds.has(row.id)}
                  note={notes[row.id]}
                  justSaved={savedId === row.id}
                  onChange={(patch) => setDraft(row, patch)}
                  onReset={() => resetDraft(row.id)}
                  onSave={() => void save(row)}
                />
              </li>
            ))}
          </ul>
          {filtered.length > shown.length && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setLimit((l) => l + SHOW_STEP)}
                className="rounded-full border border-rose-900/30 bg-white px-6 py-3 text-sm font-semibold text-rose-900"
              >
                Aur dikhao ({filtered.length - shown.length} baaki)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VariantCard({
  row,
  draft,
  busy,
  note,
  justSaved,
  onChange,
  onReset,
  onSave,
}: {
  row: VariantRow;
  draft: VariantDraft | undefined;
  busy: boolean;
  note: string | undefined;
  justSaved: boolean;
  onChange: (patch: Partial<VariantDraft>) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const value = draft ?? draftFromRow(row);
  const dirty = isDirty(row, value);
  const check = dirty ? checkDraft(row, value) : null;
  const problem = check && !check.ok && !check.unchanged ? check.message : null;
  const canSave = !!check && check.ok && !busy;
  const percent = previewPercentOff(value);
  const out = row.stock_quantity === 0;
  const low = row.stock_quantity < LOW_STOCK_BELOW;

  function step(delta: number) {
    const current = /^\d{1,6}$/.test(value.stock.trim()) ? Number(value.stock.trim()) : row.stock_quantity;
    onChange({ stock: String(Math.max(0, current + delta)) });
  }

  const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className={`rounded-2xl border bg-white p-4 shadow-sm ${dirty ? "border-rose-900/40" : "border-stone-200"} ${
        row.active ? "" : "opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            {row.color_hex && (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-stone-300" style={{ backgroundColor: row.color_hex }} />
            )}
            <span className="truncate">{row.color || "Colour"}</span>
          </p>
          <p className="truncate text-xs text-stone-500">
            {row.sku} · {row.product?.name ?? "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {!row.active && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">Inactive</span>}
          {row.active && out && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">Out of stock</span>}
          {row.active && !out && low && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Low stock</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">MRP (₹)</span>
          <input
            value={value.mrp}
            onChange={(e) => onChange({ mrp: e.target.value })}
            onFocus={selectAll}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            disabled={busy}
            aria-label={`MRP of ${row.sku}`}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">Selling price (₹)</span>
          <input
            value={value.selling}
            onChange={(e) => onChange({ selling: e.target.value })}
            onFocus={selectAll}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            disabled={busy}
            aria-label={`Selling price of ${row.sku}`}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-xs font-medium text-stone-600">Stock</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={busy}
            aria-label="Stock kam karo"
            className="h-11 w-11 shrink-0 rounded-full border border-stone-300 bg-white text-xl font-semibold text-stone-700 active:bg-stone-100 disabled:opacity-50"
          >
            −
          </button>
          <input
            value={value.stock}
            onChange={(e) => onChange({ stock: e.target.value })}
            onFocus={selectAll}
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            disabled={busy}
            aria-label={`Stock of ${row.sku}`}
            className={`${inputCls} text-center`}
          />
          <button
            type="button"
            onClick={() => step(1)}
            disabled={busy}
            aria-label="Stock badhao"
            className="h-11 w-11 shrink-0 rounded-full border border-stone-300 bg-white text-xl font-semibold text-stone-700 active:bg-stone-100 disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-stone-500">
        Saved: {formatINR(effectiveSelling(row))}
        {effectiveSelling(row) < row.price ? ` (MRP ${formatINR(row.price)})` : ""} · stock {row.stock_quantity}
        {percent != null && dirty && <span className="ml-2 font-semibold text-emerald-700">{percent}% off</span>}
      </p>

      {(problem || note) && (
        <p role="alert" className="mt-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
          {problem || note}
        </p>
      )}

      {justSaved && !dirty && (
        <p role="status" className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-xs font-medium text-emerald-700">
          Saved ✓
        </p>
      )}

      {dirty && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="flex-1 rounded-full bg-rose-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </form>
  );
}
