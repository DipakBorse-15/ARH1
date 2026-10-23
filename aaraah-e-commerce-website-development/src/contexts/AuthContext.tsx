import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { siteConfig } from "@/config/site";
import type { Profile } from "@/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string, mobile: string) => Promise<{ error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  // Which user's profile is already loaded (so token refreshes / tab focus do not show a spinner again).
  const profileUserId = useRef<string | null>(null);

  async function loadProfile(userId: string, metaMobile?: string) {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    let row = data as Profile | null;
    // The mobile number is typed at sign-up, but the profile can't be written
    // until the email is confirmed (no session yet). It rides along in the
    // sign-up metadata; the first time the customer is signed in, copy it over.
    if (row && !row.mobile && metaMobile) {
      const { error } = await supabase.from("profiles").update({ mobile: metaMobile }).eq("user_id", userId);
      if (!error) row = { ...row, mobile: metaMobile };
    }
    setProfile(row);
    profileUserId.current = userId;
  }

  function metaMobileOf(u: User | null | undefined): string | undefined {
    const m = u?.user_metadata?.mobile;
    return typeof m === "string" && m ? m : undefined;
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadProfile(data.session.user.id, metaMobileOf(data.session.user));
      }
      setLoading(false);
    });

    // A password-reset email link can land on any page (e.g. the home page when the reset
    // address is not allowed in Supabase). Always take the customer to the "new password" form.
    if (/type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search)) {
      navigate("/reset-password", { replace: true });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (_event === "PASSWORD_RECOVERY") navigate("/reset-password", { replace: true });
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const uid = newSession.user.id;
        if (profileUserId.current !== uid) {
          // A new sign-in: hold the "checking" state until the role is known, so the admin pages
          // do not bounce a real admin to the login page while the profile is still loading.
          setLoading(true);
          loadProfile(uid, metaMobileOf(newSession.user)).finally(() => setLoading(false));
        } else {
          loadProfile(uid, metaMobileOf(newSession.user));
        }
      } else {
        profileUserId.current = null;
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }

  async function signUp(email: string, password: string, fullName: string, mobile: string) {
    // Explicit redirect: don't rely on Supabase's dashboard "Site URL" being
    // correct — build it from where the app is actually running right now.
    const base = siteConfig.basePath === "/" ? "" : siteConfig.basePath.replace(/\/$/, "");
    // After confirming, land on My Account (already signed in) with a welcome note.
    const emailRedirectTo = `${window.location.origin}${base}/account?verified=1`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, mobile }, emailRedirectTo },
    });
    if (error) return { error: error.message };
    // Supabase hides "this email already exists" for privacy: it answers with a user that has no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: "An account with this email already exists. Please sign in instead." };
    }
    if (data.user) {
      // Works only when a session exists (email confirmation off); otherwise the
      // metadata above + loadProfile() fill the mobile number after first sign-in.
      await supabase.from("profiles").update({ full_name: fullName, mobile }).eq("user_id", data.user.id);
    }
    return {};
  }

  async function requestPasswordReset(email: string) {
    const base = siteConfig.basePath === "/" ? "" : siteConfig.basePath.replace(/\/$/, "");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${base}/reset-password`,
    });
    return { error: error?.message };
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id, metaMobileOf(user));
  }

  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, signIn, signUp, requestPasswordReset, updatePassword, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
