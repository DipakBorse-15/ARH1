import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LoadingState } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

/** Opened from the link in the reset email. The link signs the customer in for a moment so a new password can be set. */
export default function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== again) {
      setError("The two passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      setError(/same/i.test(error) ? "Please choose a password different from your old one." : "Could not change the password. The link may have expired — ask for a new one.");
      return;
    }
    show("Password changed. You are signed in.", "success");
    navigate("/account", { replace: true });
  }

  if (loading) return <LoadingState label="Checking your link…" />;

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <SEO title="Set New Password" canonicalPath="/reset-password" />
      <h1 className="mb-6 text-center font-serif text-3xl font-semibold text-stone-900">Set a new password</h1>
      {!user ? (
        <div className="rounded-2xl border border-stone-200 p-6 text-center text-sm text-stone-600">
          This link is not valid any more (reset links work once and expire).
          <div className="mt-4">
            <Link to="/forgot-password" className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
              Get a new link
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 p-6">
          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">New password</label>
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Type it again</label>
            <PasswordInput value={again} onChange={setAgain} autoComplete="new-password" />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </div>
  );
}
