import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <SEO title="Sign In" canonicalPath="/login" />
      <h1 className="mb-6 text-center font-serif text-3xl font-semibold text-stone-900">Welcome back</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 p-6">
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-stone-500">
        New to AARAAH?{" "}
        <Link to="/register" className="font-medium text-rose-900 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
