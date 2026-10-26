import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LoadingState } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPwa } from "@/lib/adminPwa";

/**
 * Sign-in for the admin area. It lives under /admin so the installed phone app never has to
 * leave its own address range (the shop's /login page is outside it).
 * Same email + password login as before; the session is remembered on the phone.
 */
export default function AdminLoginPage() {
  useAdminPwa();
  const { user, loading, isAdmin, signIn, signOut } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  // Only ever go back to an admin page (never to a shop page).
  const target = from && /^\/admin(\/|$)/.test(from) && from !== "/admin/login" ? from : "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // double-tap protection
    setError(null);
    setBusy(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setBusy(false);
    if (signInError) setError(signInError);
    // On success the auth context loads the profile and this page redirects below.
  }

  if (loading) return <LoadingState label="Checking your session…" />;
  if (user && isAdmin) return <Navigate to={target} replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-10">
      <SEO title="Admin Sign In" canonicalPath="/admin/login" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <img src="/pwa-admin-192.png" alt="AARAAH" width={72} height={72} className="h-[72px] w-[72px] rounded-2xl" />
          <h1 className="mt-3 font-serif text-2xl font-bold text-rose-900">Aaraah Admin</h1>
        </div>

        {user && !isAdmin ? (
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              <b>{user.email}</b> ek admin account nahi hai. Admin email se sign in karo.
            </p>
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white transition hover:bg-rose-800"
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
            {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div>
              <label htmlFor="admin-email" className="mb-1 block text-xs font-medium text-stone-600">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-rose-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Password</label>
              <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
