import { useCallback, useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/lib/supabase";
import { downloadPhotoBackup } from "@/lib/photoBackup";

interface Factor {
  id: string;
  friendly_name?: string;
  created_at?: string;
}

interface Pending {
  factorId: string;
  qr: string;
  secret: string;
}

/**
 * 2-step login for the admin: after the password, the admin also types a 6-digit code from an
 * authenticator app (Google Authenticator, Microsoft Authenticator, Authy...).
 * Once a code app is added here, the database also refuses admin actions from a session
 * that did not enter the code.
 */
export default function AdminSecurityPage() {
  const { refreshMfa } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoProgress, setPhotoProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) setError(listError.message);
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startEnroll() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Throw away half-finished attempts from earlier (an unfinished QR scan).
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const f of all?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Aaraah Admin ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      });
      if (enrollError || !data) throw new Error(enrollError?.message || "Could not start setup");
      setPending({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start setup");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ch, error: chError } = await supabase.auth.mfa.challenge({ factorId: pending.factorId });
      if (chError || !ch) throw new Error(chError?.message || "Could not check the code");
      const { error: vError } = await supabase.auth.mfa.verify({
        factorId: pending.factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vError) throw new Error("Code galat hai. App me naya 6-digit code dekho aur dobara daalo.");
      setPending(null);
      setCode("");
      await load();
      await refreshMfa();
      show("2-step login chalu ho gaya", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the code");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (pending) await supabase.auth.mfa.unenroll({ factorId: pending.factorId });
    setPending(null);
    setCode("");
    setError(null);
  }

  async function remove(factorId: string) {
    if (!confirm("2-step login band karna hai? Iske baad sirf password se login hoga.")) return;
    setBusy(true);
    setError(null);
    const { error: rmError } = await supabase.auth.mfa.unenroll({ factorId });
    if (rmError) setError(rmError.message);
    else show("2-step login band kar diya", "success");
    await load();
    await refreshMfa();
    setBusy(false);
  }

  async function backupPhotos() {
    if (photoProgress !== null) return;
    if (!confirm("Saari product photos ek ZIP me download hongi (kuch minute lagenge). Laptop par karo. Chalu karein?")) return;
    setError(null);
    setPhotoProgress("Shuru ho raha hai…");
    try {
      const r = await downloadPhotoBackup((d, t) => setPhotoProgress(`${d} / ${t} photos`));
      show(r.failed ? `ZIP ban gaya. ${r.failed} photo nahi aa payi.` : `ZIP ban gaya (${r.saved} photos)`, r.failed ? "info" : "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo backup nahi ho paya");
    } finally {
      setPhotoProgress(null);
    }
  }

  if (loading) return <LoadingState label="Loading…" />;

  const active = factors.length > 0;

  return (
    <div className="mx-auto max-w-md">
      <SEO title="Security" canonicalPath="/admin/security" />
      <h1 className="mb-4 font-serif text-xl font-bold text-rose-900">Security (2-step login)</h1>

      {error && <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-sm font-semibold text-stone-800">
          Status:{" "}
          <span className={active ? "text-emerald-700" : "text-amber-700"}>{active ? "Chalu hai" : "Band hai"}</span>
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Password ke baad authenticator app ka 6-digit code bhi lagega. Is account ke liye ye apne phone me ek baar set karo.
        </p>

        {!active && !pending && (
          <button
            type="button"
            disabled={busy}
            onClick={startEnroll}
            className="mt-4 w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white active:bg-rose-950 disabled:opacity-60"
          >
            {busy ? "Ruko..." : "2-step login chalu karo"}
          </button>
        )}

        {pending && (
          <form onSubmit={confirmEnroll} className="mt-4 space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-xs text-stone-600">
              <li>Phone me Google Authenticator ya Microsoft Authenticator kholo.</li>
              <li>"+" dabao, "Scan QR code" chuno aur neeche ka QR scan karo.</li>
              <li>App me jo 6-digit code dikhe wo yahan daalo.</li>
            </ol>
            <img src={pending.qr} alt="QR code" className="mx-auto h-44 w-44 rounded-lg border border-stone-200 bg-white p-1" />
            <p className="break-all text-center text-[11px] text-stone-500">
              QR scan na ho to ye key app me haath se daalo: <b className="select-all text-stone-800">{pending.secret}</b>
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="w-full rounded-lg border border-stone-300 px-3 py-3 text-center text-lg tracking-widest focus:border-rose-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white active:bg-rose-950 disabled:opacity-50"
            >
              {busy ? "Check ho raha hai…" : "Code check karo aur chalu karo"}
            </button>
            <button type="button" onClick={cancelEnroll} className="w-full py-2 text-xs font-medium text-stone-500 underline">
              Cancel
            </button>
          </form>
        )}

        {active &&
          factors.map((f) => (
            <div key={f.id} className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-stone-50 p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-stone-700">{f.friendly_name || "Authenticator app"}</p>
                {f.created_at && <p className="text-[11px] text-stone-400">{new Date(f.created_at).toLocaleDateString("en-IN")}</p>}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(f.id)}
                className="shrink-0 rounded-full border border-rose-900 px-3 py-1.5 text-xs font-semibold text-rose-900 disabled:opacity-50"
              >
                Band karo
              </button>
            </div>
          ))}
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-sm font-semibold text-stone-800">Photos ka backup</p>
        <p className="mt-1 text-xs text-stone-500">
          Mahine me ek baar laptop par dabao. Saari product photos SKU ke folder me ek ZIP me aati hain. ZIP ko apne PC / Google Drive me rakho. Ye Supabase se
          lagbhag 0.25 GB download karta hai (5 GB limit me se), isliye mahine me ek hi baar.
        </p>
        <button
          type="button"
          disabled={photoProgress !== null}
          onClick={backupPhotos}
          className="mt-3 w-full rounded-full border border-rose-900 py-3 text-sm font-semibold text-rose-900 active:bg-rose-50 disabled:opacity-60"
        >
          {photoProgress ?? "Photos ZIP download karo"}
        </button>
      </div>
    </div>
  );
}
