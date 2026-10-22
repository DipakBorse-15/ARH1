import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Last safety net: if any screen crashes while drawing, the customer sees a
 * friendly message instead of a blank white page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <p className="font-serif text-3xl font-bold text-rose-900">AARAAH</p>
        <h1 className="mt-6 text-xl font-semibold text-stone-900">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-sm text-stone-500">
          Sorry, this page could not be shown. Please refresh, or go back to the home page. Your cart is safe.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Refresh
          </button>
          <a href="/" className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700">
            Go to Home
          </a>
        </div>
      </div>
    );
  }
}
