import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { moreLinks } from "@/layouts/adminLinks";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/pushNotifications";
import { useToast } from "@/contexts/ToastContext";

/** Switch for phone alerts: new paid order, paid order cancelled, low stock. */
function PushAlertsCard({ userId }: { userId: string }) {
  const { show } = useToast();
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
        show("Alerts band kar diye", "success");
      } else {
        await enablePush(userId);
        setState("on");
        show("Alerts chalu ho gaye", "success");
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "Alerts chalu nahi ho paye", "error");
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-stone-800">Phone alerts</p>
      <p className="mt-1 text-xs text-stone-500">Naya paid order, paid order cancel, stock 5 se kam.</p>
      {state === "unsupported" ? (
        <p className="mt-3 text-xs text-stone-600">Ye browser alerts support nahi karta. App ko Chrome se home screen par add karo.</p>
      ) : state === "blocked" ? (
        <p className="mt-3 text-xs text-rose-700">Alerts phone ki settings me band hain. Settings → Apps → Aaraah Admin → Notifications allow karo.</p>
      ) : (
        <button
          type="button"
          disabled={busy || state === "loading"}
          onClick={toggle}
          className={`mt-3 w-full rounded-full py-3 text-sm font-semibold disabled:opacity-60 ${
            state === "on" ? "border border-stone-300 text-stone-700 active:bg-stone-50" : "bg-rose-900 text-white active:bg-rose-950"
          }`}
        >
          {busy ? "Ruko..." : state === "on" ? "Alerts band karo" : "Alerts chalu karo"}
        </button>
      )}
    </div>
  );
}

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

      {user && <PushAlertsCard userId={user.id} />}

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
