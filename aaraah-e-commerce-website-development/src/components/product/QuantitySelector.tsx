export function QuantitySelector({
  quantity,
  onChange,
  max,
}: {
  quantity: number;
  onChange: (q: number) => void;
  max: number;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-stone-300">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, quantity - 1))}
        className="h-9 w-9 rounded-full text-lg text-stone-600 transition hover:bg-stone-100 disabled:opacity-30"
        disabled={quantity <= 1}
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-medium">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, quantity + 1))}
        className="h-9 w-9 rounded-full text-lg text-stone-600 transition hover:bg-stone-100 disabled:opacity-30"
        disabled={quantity >= max}
      >
        +
      </button>
    </div>
  );
}
