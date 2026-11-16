import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOrderById } from "@/services/orders";
import { friendlyError } from "@/lib/supabase";
import type { Order } from "@/types";

/** Loads an order and keeps it fresh: re-checks every 8s (60s after 10 minutes) while it is still
 *  waiting on the shop (pending / payment not received), and whenever the
 *  customer comes back to the tab — so an admin's "Confirmed" shows up
 *  without a manual refresh. */
export function useLiveOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasOrder = useRef(false);
  hasOrder.current = !!order;

  const refetch = useCallback(async () => {
    if (!orderId) return;
    try {
      const o = await fetchOrderById(orderId);
      setError(null);
      setOrder((prev) =>
        prev && o && prev.status === o.status && prev.payment_status === o.payment_status && prev.payment_reference === o.payment_reference ? prev : o
      );
    } catch (err) {
      // A background refresh that fails (weak network) must not throw away an order that is already on screen.
      if (!hasOrder.current) setError((e) => e ?? friendlyError(err));
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    fetchOrderById(orderId)
      .then(setOrder)
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [orderId]);

  // A cancelled order never changes again (its payment stays "pending" for ever), so stop asking.
  const waiting =
    !!order &&
    order.status !== "cancelled" &&
    (order.status === "pending" || (order.payment_method === "upi" && order.payment_status !== "paid"));

  useEffect(() => {
    if (!waiting) return;
    // Fast (8 s) for the first 10 minutes, then every 60 s; nothing is asked while the tab is hidden.
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (document.visibilityState === "visible") refetch();
      timer = setTimeout(tick, Date.now() - startedAt < 10 * 60_000 ? 8000 : 60_000);
    };
    timer = setTimeout(tick, 8000);
    const onVisible = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refetch);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refetch);
    };
  }, [waiting, refetch]);

  return { order, loading, error, refetch };
}
