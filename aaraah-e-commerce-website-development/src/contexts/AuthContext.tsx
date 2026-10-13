import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        loadProfile(newSession.user.id, metaMobileOf(newSession.user));
      } else {
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
    if (data.user) {
      // Works only when a session exists (email confirmation off); otherwise the
      // metadata above + loadProfile() fill the mobile number after first sign-in.
      await supabase.from("profiles").update({ full_name: fullName, mobile }).eq("user_id", data.user.id);
    }
    return {};
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
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
