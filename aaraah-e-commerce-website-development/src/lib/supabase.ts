import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/config/site";

const url = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "placeholder-anon-key";

/**
 * Single shared Supabase client instance. The app remains renderable even
 * when Supabase env vars are missing (e.g. first-time clone before setup) —
 * every data hook checks `isSupabaseConfigured` and surfaces a friendly
 * "backend not configured" state instead of crashing the whole SPA.
 */
export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export { isSupabaseConfigured };

/** Turns Supabase/Postgrest errors into safe, user-friendly messages. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const message = typeof error === "string" ? error : (error as { message?: string })?.message;
  if (!message) return fallback;

  if (/JWT|not authenticated|auth/i.test(message)) return "Please sign in to continue.";
  if (/duplicate key|already exists/i.test(message)) return "This record already exists.";
  if (/permission denied|RLS|policy/i.test(message)) return "You don't have permission to do that.";
  if (/network|fetch/i.test(message)) return "Network error. Please check your connection.";

  // In development, show the real message to help debugging.
  if (import.meta.env.DEV) return message;
  return fallback;
}
