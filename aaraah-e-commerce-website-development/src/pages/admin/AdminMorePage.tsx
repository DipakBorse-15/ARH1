import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { moreLinks } from "@/layouts/adminLinks";

/** Phone "More" tab: every other admin page, plus sign out. */
export default function AdminMorePage() {
  const { profile, user, signOut } = useAuth();
  const email = profile?.email || user?.email || "";

  function handleSignOut() {
    if (confirm("Sign out karna hai?")) void signOut();
  }

  return (
    <div className="mx-auto max-w-md">
      <SEO title="More" canonicalPath="/admin/more" />
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {moreLinks.map((l, i) => (
          <Link
            key={l.to}
            to={l.to}
            className={`flex min-h-[52px] items-center justify-between px-4 text-sm font-medium text-stone-800 active:bg-stone-50 ${
              i > 0 ? "border-t border-stone-100" : ""
            }`}
          >
            {l.label}
            <span aria-hidden="true" className="text-stone-400">
              ›
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-xs text-stone-500">Signed in as</p>
        <p className="mb-3 break-all text-sm font-medium text-stone-800">{email}</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full rounded-full border border-rose-900 py-3 text-sm font-semibold text-rose-900 active:bg-rose-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
