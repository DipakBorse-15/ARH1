import { Link } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export function AnnouncementBar() {
  const { settings } = useSiteSettings();
  if (!settings) return null;

  const bars = [
    {
      active: settings.announcement_active,
      text: settings.announcement_text,
      link: settings.announcement_link,
      className: "bg-stone-900 text-white",
    },
    {
      active: settings.announcement2_active,
      text: settings.announcement2_text,
      link: settings.announcement2_link,
      className: "bg-amber-50 text-stone-800",
    },
  ];

  const visible = bars.filter((b) => b.active && b.text);
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((b, i) => {
        const content = <p className="truncate">{b.text}</p>;
        return (
          <div key={i} className={`px-4 py-2 text-center text-xs font-medium sm:text-sm ${b.className}`}>
            {b.link ? (
              <Link to={b.link} className="hover:underline">
                {content}
              </Link>
            ) : (
              content
            )}
          </div>
        );
      })}
    </>
  );
}
