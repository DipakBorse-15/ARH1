import { supabase } from "@/lib/supabase";

/**
 * Phone alerts for the Aaraah Admin app (Web Push). The public key is meant to be public;
 * the private key lives only in Supabase secrets.
 */
const VAPID_PUBLIC_KEY = "BF4IlGSVEC5i-zPWDvgK9QgV-J_teIB7ZhdZO1dTl5c-8y5eTOO3_sCksvO3-GFu7-S_gm813j2dUifyL0ZwC6U";

export type PushState = "unsupported" | "blocked" | "off" | "on";

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return navigator.serviceWorker.ready;
}

/** Is this phone already subscribed? */
export async function getPushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

/** Ask permission, subscribe this phone and save it for the admin. Throws a readable message on failure. */
export async function enablePush(userId: string): Promise<void> {
  if (!supported()) throw new Error("Is phone/browser me alerts support nahi hain.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification ki permission nahi mili. Phone ki settings me Aaraah Admin ke notifications allow karo.");
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  }
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error("Subscription adhoori mili, dobara try karo.");
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: json.endpoint, p256dh, auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: "endpoint" });
  if (error) throw error;
}

/** Switch alerts off on this phone. */
export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
