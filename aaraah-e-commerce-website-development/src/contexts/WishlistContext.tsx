import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { addWishlist, fetchWishlistIds, removeWishlist } from "@/services/wishlist";
import { friendlyError } from "@/lib/supabase";

interface WishlistValue {
  ids: Set<string>;
  has: (variantId: string) => boolean;
  /** Returns false when the visitor has to sign in first. */
  toggle: (variantId: string) => Promise<boolean>;
}

const WishlistContext = createContext<WishlistValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    fetchWishlistIds(user.id)
      .then((list) => !cancelled && setIds(new Set(list)))
      .catch(() => {
        /* the heart simply starts empty if this fails */
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = useCallback(
    async (variantId: string) => {
      if (!user) return false;
      const had = ids.has(variantId);
      // Optimistic: flip now, undo if the database refuses.
      setIds((prev) => {
        const next = new Set(prev);
        if (had) next.delete(variantId);
        else next.add(variantId);
        return next;
      });
      try {
        if (had) await removeWishlist(user.id, variantId);
        else await addWishlist(user.id, variantId);
      } catch (err) {
        setIds((prev) => {
          const next = new Set(prev);
          if (had) next.add(variantId);
          else next.delete(variantId);
          return next;
        });
        show(friendlyError(err, "Could not update your wishlist."), "error");
      }
      return true;
    },
    [user, ids, show]
  );

  const value = useMemo<WishlistValue>(() => ({ ids, has: (id) => ids.has(id), toggle }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
