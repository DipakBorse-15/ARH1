export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="status" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-rose-900/20 border-t-rose-900" />
      <p className="text-sm text-stone-500">{label}</p>
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-2xl text-rose-700">!</div>
      <p className="max-w-sm text-sm text-stone-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-full border border-rose-900/20 px-4 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-900 hover:text-white"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  message,
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-3xl">🌸</div>
      <h3 className="text-lg font-semibold text-stone-800">{title}</h3>
      {message && <p className="max-w-sm text-sm text-stone-500">{message}</p>}
      {action}
    </div>
  );
}
