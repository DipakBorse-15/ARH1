import { Link, useNavigate } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";

export default function CartPage() {
  const { items, loading, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const shipping = subtotal > 0 && subtotal < 999 ? 79 : 0;

  function goToCheckout() {
    if (!user) {
      navigate("/login", { state: { from: "/cart" } });
      return;
    }
    navigate("/checkout");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <SEO title="Your Cart" canonicalPath="/cart" />
      <h1 className="mb-6 font-serif text-3xl font-semibold text-stone-900">Your Cart</h1>

      {loading && <LoadingState label="Loading your cart…" />}

      {!loading && !user && (
        <EmptyState
          title="Sign in to view your cart"
          message="Create an account or sign in to add items and check out."
          action={
            <Link to="/login" className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
              Sign in
            </Link>
          }
        />
      )}

      {!loading && user && items.length === 0 && (
        <EmptyState
          title="Your cart is empty"
          message="Explore our collections and add something beautiful."
          action={
            <Link to="/" className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
              Continue shopping
            </Link>
          }
        />
      )}

      {!loading && user && items.length > 0 && (
        <div className="grid gap-8 md:grid-cols-[1fr_320px]">
          <div>
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>
          <div className="h-fit rounded-2xl border border-stone-200 p-5">
            <h2 className="mb-4 font-semibold text-stone-900">Order Summary</h2>
            <div className="space-y-2 text-sm text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatINR(subtotal + shipping)}</span>
              </div>
            </div>
            <button
              onClick={goToCheckout}
              className="mt-5 w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white transition hover:bg-rose-800"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
