import { useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Stars } from "@/components/product/ReviewsSection";
import { useToast } from "@/contexts/ToastContext";
import { deleteReview, fetchAllReviewsAdmin, setReviewStatus } from "@/services/reviews";
import { friendlyError } from "@/lib/supabase";

type Row = Awaited<ReturnType<typeof fetchAllReviewsAdmin>>[number];

export default function AdminReviewsPage() {
  const { show } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await fetchAllReviewsAdmin());
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(r: Row) {
    try {
      await setReviewStatus(r.id, r.status === "published" ? "hidden" : "published");
      await load();
    } catch (e) {
      show(friendlyError(e), "error");
    }
  }
  async function remove(r: Row) {
    if (!confirm("Delete this review permanently?")) return;
    try {
      await deleteReview(r.id);
      await load();
    } catch (e) {
      show(friendlyError(e), "error");
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!rows) return <LoadingState />;

  return (
    <div className="max-w-3xl">
      <SEO title="Reviews" canonicalPath="/admin/reviews" />
      <h1 className="mb-2 font-serif text-2xl font-semibold text-stone-900">Reviews</h1>
      <p className="mb-6 text-sm text-stone-500">Reviews go live as soon as a customer who received the product posts them. Hide any you do not want shown.</p>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 p-6 text-sm text-stone-500">No reviews yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-2xl border p-4 ${r.status === "hidden" ? "border-stone-200 bg-stone-50 opacity-70" : "border-stone-200 bg-white"}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Stars value={r.rating} />
                <span className="font-medium text-stone-900">{r.product?.name || "Product"}</span>
                <span className="text-xs text-stone-400">
                  by {r.reviewer_name} · {new Date(r.created_at).toLocaleDateString("en-IN")}
                </span>
                {r.status === "hidden" && <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">HIDDEN</span>}
              </div>
              {r.title && <p className="mt-1 text-sm font-semibold text-stone-800">{r.title}</p>}
              <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{r.body}</p>
              <div className="mt-2 space-x-4 text-xs">
                <button onClick={() => toggle(r)} className="text-rose-900 hover:underline">
                  {r.status === "published" ? "Hide" : "Show again"}
                </button>
                <button onClick={() => remove(r)} className="text-rose-600 hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
