import { useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await requestPasswordReset(email);
    setLoading(false);
    if (error) {
      setError(/rate|seconds|too many/i.test(error) ? "Please wait a minute before asking for another email." : "Could not send the email. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <SEO title="Forgot Password" canonicalPath="/forgot-password" />
      <h1 className="mb-2 text-center font-serif text-3xl font-semibold text-stone-900">Forgot your password?</h1>
      <p className="mb-6 text-center text-sm text-stone-500">Enter your email and we will send you a link to set a new password.</p>
      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-800">
          If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way. Please check your inbox (and spam folder).
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 p-6">
          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-stone-500">
        <Link to="/login" className="font-medium text-rose-900 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
