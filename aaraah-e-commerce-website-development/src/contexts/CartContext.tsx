import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import * as cartService from "@/services/cart";
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

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setItems([]);
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
  }, [user, show]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (variantId: string, quantity: number) => {
      if (!user) {
        show("Please sign in to add items to your cart.", "error");
        return false;
      }
      try {
        await cartService.addToCart(user.id, variantId, quantity);
        await refresh();
        show("Added to cart", "success");
        return true;
      } catch (err) {
        show(friendlyError(err, "Could not add item to cart."), "error");
        return false;
      }
    },
    [user, refresh, show]
  );

  const increment = useCallback(
    async (item: CartItem) => {
      const stock = item.variant?.stock_quantity ?? 0;
      if (item.quantity + 1 > stock) {
        show("No more stock available for this item.", "error");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)));
      try {
        await cartService.updateCartQuantity(item.id, item.quantity + 1);
      } catch (err) {
        show(friendlyError(err), "error");
        refresh();
      }
    },
    [refresh, show]
  );

  const decrement = useCallback(
    async (item: CartItem) => {
      const nextQty = item.quantity - 1;
      setItems((prev) =>
        nextQty <= 0 ? prev.filter((i) => i.id !== item.id) : prev.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i))
      );
      try {
        await cartService.updateCartQuantity(item.id, nextQty);
      } catch (err) {
        show(friendlyError(err), "error");
        refresh();
      }
    },
    [refresh, show]
  );

  const removeItem = useCallback(
    async (item: CartItem) => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      try {
        await cartService.removeCartItem(item.id);
      } catch (err) {
        show(friendlyError(err), "error");
        refresh();
      }
    },
    [refresh, show]
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
