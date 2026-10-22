import { useLocation, useNavigate } from "react-router-dom";
import { useWishlist } from "@/contexts/WishlistContext";
import { useToast } from "@/contexts/ToastContext";

/** Heart that saves one colour to the customer's wishlist. Sends guests to sign in first. */
export function WishlistButton({ variantId, className = "" }: { variantId: string; className?: string }) {
  const { has, toggle } = useWishlist();
  const { show } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = has(variantId);

  async function onClick(e: React.MouseEvent) {
    // The card around it is a link — don't open the product when the heart is tapped.
    e.preventDefault();
    e.stopPropagation();
    const ok = await toggle(variantId);
    if (!ok) {
      show("Please sign in to save items to your wishlist.", "error");
      navigate("/login", { state: { from: location.pathname + location.search } });
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow transition hover:scale-110 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "#9f1239" : "none"} stroke={saved ? "#9f1239" : "#57534e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
