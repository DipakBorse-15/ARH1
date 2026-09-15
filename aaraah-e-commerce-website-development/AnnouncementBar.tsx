import { Link } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export function AnnouncementBar() {
  const { settings } = useSiteSettings();
  if (!settings?.announcement_active || !settings.announcement_text) return null;

  const content = (
    <p className="truncate">{settings.announcement_text}</p>
  );

  return (
    <div className="bg-stone-900 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      {settings.announcement_link ? (
        <Link to={settings.announcement_link} className="hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
