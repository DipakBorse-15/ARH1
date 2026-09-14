import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName, mobile);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate("/login"), 1800);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <SEO title="Create Account" canonicalPath="/register" />
      <h1 className="mb-6 text-center font-serif text-3xl font-semibold text-stone-900">Create your account</h1>
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-800">
          Account created! Check your email to verify, then sign in.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 p-6">
          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Full Name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Mobile Number</label>
            <input
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
          </div>
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
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-stone-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-rose-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
