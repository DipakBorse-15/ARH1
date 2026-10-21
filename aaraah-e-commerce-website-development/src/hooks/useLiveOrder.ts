import { useCallback, useEffect, useState } from "react";
import { fetchOrderById } from "@/services/orders";
import { friendlyError } from "@/lib/supabase";
import type { Order } from "@/types";

/** Loads an order and keeps it fresh: re-checks every 8s while it is still
 *  waiting on the shop (pending / payment not received), and whenever the
 *  customer comes back to the tab — so an admin's "Confirmed" shows up
 *  without a manual refresh. */
export function useLiveOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!orderId) return;
    try {
      const o = await fetchOrderById(orderId);
      setError(null);
      setOrder((prev) =>
        prev && o && prev.status === o.status && prev.payment_status === o.payment_status ? prev : o
      );
    } catch (err) {
      setError((e) => e ?? friendlyError(err));
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

  const waiting = !!order && (order.status === "pending" || (order.payment_method === "upi" && order.payment_status !== "paid"));

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(refetch, 8000);
    const onVisible = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refetch);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refetch);
    };
  }, [waiting, refetch]);

  return { order, loading, error, refetch };
}
