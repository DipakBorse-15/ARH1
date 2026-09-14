import { useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { AccountNav } from "@/components/account/AccountNav";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { supabase, friendlyError } from "@/lib/supabase";

export default function AccountPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { show } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [mobile, setMobile] = useState(profile?.mobile || "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName, mobile }).eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      show("Profile updated", "success");
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <SEO title="My Account" canonicalPath="/account" />
      <h1 className="mb-4 font-serif text-3xl font-semibold text-stone-900">My Account</h1>
      <AccountNav />

      <form onSubmit={handleSave} className="max-w-md space-y-4 rounded-2xl border border-stone-200 p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Email</label>
          <input disabled value={user?.email || ""} className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Full Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Mobile</label>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <button onClick={() => signOut()} className="mt-6 text-sm font-medium text-rose-700 hover:underline">
        Sign out
      </button>
    </div>
  );
}
