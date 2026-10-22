import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import * as cartService from "@/services/cart";
import { CartLimitError, MAX_PER_ITEM, assertCartLimit, fetchVariantStock } from "@/services/cart";
import { readGuestCart, writeGuestCart } from "@/services/guestCart";
import { effectivePrice } from "@/services/products";
import { friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import type { CartItem } from "@/types";

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (variantId: string, quantity: number) => Promise<boolean>;
  increment: (item: CartItem) => Promise<void>;
  decrement: (item: CartItem) => Promise<void>;
  removeItem: (item: CartItem) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const GUEST_PREFIX = "guest-";
const isGuestItem = (item: CartItem) => item.id.startsWith(GUEST_PREFIX);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const mergingFor = useRef<string | null>(null);

  /** Builds the visitor's cart (kept in this browser) from the saved lines. */
  const loadGuestCart = useCallback(async () => {
    const lines = readGuestCart();
    if (!lines.length || !isSupabaseConfigured) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const variants = await cartService.fetchVariantsForCart(lines.map((l) => l.variant_id));
      const byId = new Map(variants.map((v) => [v.id, v]));
      const live = lines.filter((l) => byId.has(l.variant_id));
      if (live.length !== lines.length) writeGuestCart(live); // drop items that no longer exist
      setItems(
        live.map((l) => ({
          id: `${GUEST_PREFIX}${l.variant_id}`,
          user_id: "",
          variant_id: l.variant_id,
          quantity: l.quantity,
          created_at: "",
          updated_at: "",
          variant: byId.get(l.variant_id),
        }))
      );
    } catch (err) {
      show(friendlyError(err, "Could not load your cart."), "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      await loadGuestCart();
      return;
    }
    setLoading(true);
    try {
      const data = await cartService.fetchCart(user.id);
      setItems(data);
    } catch (err) {
      show(friendlyError(err, "Could not load your cart."), "error");
    } finally {
      setLoading(false);
    }
  }, [user, show, loadGuestCart]);

  // When a visitor signs in, whatever they had put in the browser cart moves into their account cart.
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    const lines = readGuestCart();
    if (!lines.length || mergingFor.current === user.id) return;
    mergingFor.current = user.id;
    (async () => {
      for (const l of lines) {
        try {
          await cartService.addToCart(user.id, l.variant_id, l.quantity);
        } catch {
          /* out of stock / over the limit: skip that line, keep the rest */
        }
      }
      writeGuestCart([]);
      mergingFor.current = null;
      await refresh();
    })();
  }, [user, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (variantId: string, quantity: number) => {
      try {
        if (!user) {
          const lines = readGuestCart();
          const existing = lines.find((l) => l.variant_id === variantId);
          assertCartLimit(existing?.quantity ?? 0, quantity, await fetchVariantStock(variantId));
          if (existing) existing.quantity += quantity;
          else lines.push({ variant_id: variantId, quantity });
          writeGuestCart(lines);
          await loadGuestCart();
          show("Added to cart", "success");
          return true;
        }
        await cartService.addToCart(user.id, variantId, quantity);
        await refresh();
        show("Added to cart", "success");
        return true;
      } catch (err) {
        show(err instanceof CartLimitError ? err.message : friendlyError(err, "Could not add item to cart."), "error");
        return false;
      }
    },
    [user, refresh, loadGuestCart, show]
  );

  /** Saves a new quantity for a line (0 removes it), for both guest and signed-in carts. */
  const saveQuantity = useCallback(
    async (item: CartItem, nextQty: number) => {
      if (isGuestItem(item)) {
        const lines = readGuestCart()
          .map((l) => (l.variant_id === item.variant_id ? { ...l, quantity: nextQty } : l))
          .filter((l) => l.quantity > 0);
        writeGuestCart(lines);
        return;
      }
      if (nextQty <= 0) await cartService.removeCartItem(item.id);
      else await cartService.updateCartQuantity(item.id, nextQty);
    },
    []
  );

  const increment = useCallback(
    async (item: CartItem) => {
      const stock = item.variant?.stock_quantity ?? 0;
      if (item.quantity + 1 > stock) {
        show("No more stock available for this item.", "error");
        return;
      }
      if (item.quantity + 1 > MAX_PER_ITEM) {
        show(`You can order up to ${MAX_PER_ITEM} of one item at a time.`, "error");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)));
      try {
        await saveQuantity(item, item.quantity + 1);
      } catch (err) {
        show(friendlyError(err), "error");
        refresh();
      }
    },
    [refresh, show, saveQuantity]
  );

  const decrement = useCallback(
    async (item: CartItem) => {
      const nextQty = item.quantity - 1;
      setItems((prev) =>
        nextQty <= 0 ? prev.filter((i) => i.id !== item.id) : prev.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i))
      );
      try {
        await saveQuantity(item, nextQty);
      } catch (err) {
        show(friendlyError(err), "error");
        refresh();
      }
    },
    [refresh, show, saveQuantity]
  );

  const removeItem = useCallback(
    async (item: CartItem) => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      try {
        await saveQuantity(item, 0);
      } catch (err) {
        show(friendlyError(err), "error");
        refresh();
      }
    },
    [refresh, show, saveQuantity]
  );

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.variant ? effectivePrice(i.variant) * i.quantity : 0), 0),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, loading, itemCount, subtotal, addItem, increment, decrement, removeItem, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
