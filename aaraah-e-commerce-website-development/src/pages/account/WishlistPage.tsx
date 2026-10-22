import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { AccountNav } from "@/components/account/AccountNav";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { fetchWishlistEntries, type WishlistEntry } from "@/services/wishlist";
import { friendlyError } from "@/lib/supabase";

export default function WishlistPage() {
  const { user } = useAuth();
  const { ids } = useWishlist();
  const [entries, setEntries] = useState<WishlistEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchWishlistEntries(user.id)
      .then(setEntries)
      .catch((e) => setError(friendlyError(e, "Could not load your wishlist.")));
    // Loaded once; hearts that are un-saved here disappear below via `ids`.
  }, [user]);

  const shown = (entries || []).filter((e) => ids.has(e.variant.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <SEO title="My Wishlist" canonicalPath="/account/wishlist" />
      <h1 className="mb-4 font-serif text-3xl font-semibold text-stone-900">My Account</h1>
      <AccountNav />
      {error ? (
        <ErrorState message={error} />
      ) : entries === null ? (
        <LoadingState label="Loading wishlist…" />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-600">
          <p className="mb-3">Your wishlist is empty. Tap the heart on any product to save it here.</p>
          <Link to="/" className="font-medium text-rose-900 underline">
            Continue shopping
          </Link>
        </div>
      ) : (
        <ProductGrid items={shown} columnsClass="grid-cols-2 md:grid-cols-3" />
      )}
    </div>
  );
}
