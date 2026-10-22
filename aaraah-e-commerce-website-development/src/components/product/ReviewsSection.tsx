import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { canReview, fetchReviews, submitReview, type Review } from "@/services/reviews";
import { friendlyError } from "@/lib/supabase";

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={n <= Math.round(value) ? "#d97706" : "#e7e5e4"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

/** Loads a product's reviews once; the product page uses the numbers for the rating line and search-result stars. */
export function useReviews(productId: string | undefined) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    fetchReviews(productId)
      .then((r) => !cancelled && setReviews(r))
      .catch(() => !cancelled && setReviews([]));
    return () => {
      cancelled = true;
    };
  }, [productId, version]);
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { reviews, count, average, reload: () => setVersion((v) => v + 1) };
}

export function ReviewsSection({
  productId,
  reviews,
  average,
  onChanged,
}: {
  productId: string;
  reviews: Review[];
  average: number;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [allowed, setAllowed] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const mine = reviews.find((r) => r.user_id && user && r.user_id === user.id);

  useEffect(() => {
    setAllowed(false);
    if (!user) return;
    canReview(productId).then(setAllowed);
  }, [user, productId]);

  useEffect(() => {
    if (mine) {
      setRating(mine.rating);
      setTitle(mine.title || "");
      setBody(mine.body);
    }
  }, [mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) return show("Please choose a star rating.", "error");
    if (!body.trim()) return show("Please write a few words about the product.", "error");
    setSaving(true);
    try {
      await submitReview(productId, rating, title, body);
      show(mine ? "Your review is updated." : "Thank you! Your review is published.", "success");
      onChanged();
    } catch (err) {
      show(friendlyError(err, "Could not save your review."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-16 border-t border-stone-200 pt-10" id="reviews">
      <h2 className="font-serif text-2xl font-semibold text-stone-900">Customer reviews</h2>
      {reviews.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-600">
          <Stars value={average} size={18} />
          <span className="font-semibold text-stone-900">{average.toFixed(1)}</span>
          <span>
            · {reviews.length} review{reviews.length > 1 ? "s" : ""}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-stone-500">No reviews yet.</p>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_320px]">
        <ul className="space-y-5">
          {reviews.map((r) => (
            <li key={r.id} className="border-b border-stone-100 pb-5">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                {r.title && <span className="text-sm font-semibold text-stone-900">{r.title}</span>}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-700">{r.body}</p>
              <p className="mt-1 text-xs text-stone-400">
                {r.reviewer_name} · Verified buyer · {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </li>
          ))}
        </ul>

        <div className="h-fit rounded-2xl border border-stone-200 p-5">
          {!user ? (
            <p className="text-sm text-stone-600">
              <Link to="/login" state={{ from: `${window.location.pathname}#reviews` }} className="font-medium text-rose-900 underline">
                Sign in
              </Link>{" "}
              to review a product you have bought.
            </p>
          ) : !allowed ? (
            <p className="text-sm text-stone-600">Only customers who have received this product can review it.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">{mine ? "Edit your review" : "Write a review"}</h3>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill={n <= rating ? "#d97706" : "#e7e5e4"}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="Headline (optional)"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1500}
                rows={4}
                placeholder="How was the fabric, fit and colour?"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
              />
              <button type="submit" disabled={saving} className="rounded-full bg-rose-900 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">
                {saving ? "Saving…" : mine ? "Update review" : "Submit review"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
