import { siteConfig } from "@/config/site";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
    </svg>
  );
}

/**
 * Instagram / Facebook round icons. Links come from Admin → Home Editor → Social Links;
 * an empty link hides that icon. Only if settings could not be loaded at all, the built-in links are used.
 */
export function SocialLinks({ label, className = "" }: { label?: string; className?: string }) {
  const { settings, loading } = useSiteSettings();
  const instagram = settings ? settings.instagram_url : loading ? null : siteConfig.social.instagram;
  const facebook = settings ? settings.facebook_url : loading ? null : siteConfig.social.facebook;
  if (!instagram && !facebook) return null;

  const iconClass =
    "flex h-11 w-11 items-center justify-center rounded-full border border-rose-900/30 text-rose-900 transition hover:bg-rose-900 hover:text-white active:bg-rose-900 active:text-white";

  return (
    <div className={className}>
      {label && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>}
      <div className="flex items-center gap-3">
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="AARAAH on Instagram" className={iconClass}>
            <InstagramIcon />
          </a>
        )}
        {facebook && (
          <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="AARAAH on Facebook" className={iconClass}>
            <FacebookIcon />
          </a>
        )}
      </div>
    </div>
  );
}
