export interface FontOption {
  /** Value stored in site_settings.font_family */
  value: string;
  /** Shown in the admin dropdown */
  label: string;
  /** Google Fonts request string, e.g. "Poppins:wght@400;500;600;700" */
  googleFontSpec: string;
  /** CSS fallback stack */
  fallback: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { value: "Inter", label: "Inter (default, clean & modern)", googleFontSpec: "Inter:wght@400;500;600;700", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { value: "Poppins", label: "Poppins (rounded & friendly)", googleFontSpec: "Poppins:wght@400;500;600;700", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { value: "Roboto", label: "Roboto (neutral & readable)", googleFontSpec: "Roboto:wght@400;500;700", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { value: "Lato", label: "Lato (soft & warm)", googleFontSpec: "Lato:wght@400;700", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { value: "Nunito", label: "Nunito (soft, rounded)", googleFontSpec: "Nunito:wght@400;600;700", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { value: "Montserrat", label: "Montserrat (bold & geometric)", googleFontSpec: "Montserrat:wght@400;500;600;700", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { value: "Rubik", label: "Rubik (playful, slightly rounded)", googleFontSpec: "Rubik:wght@400;500;600;700", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { value: "Mukta", label: "Mukta (great for Hindi/English mix)", googleFontSpec: "Mukta:wght@400;500;600;700", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { value: "Merriweather", label: "Merriweather (elegant, serif body text)", googleFontSpec: "Merriweather:wght@400;700", fallback: "Georgia, serif" },
];

const loadedFonts = new Set<string>();

/** Injects the Google Fonts <link> for this font (once) and applies it site-wide via the --font-sans CSS variable. */
export function applySiteFont(fontValue: string) {
  const option = FONT_OPTIONS.find((f) => f.value === fontValue) || FONT_OPTIONS[0];

  if (!loadedFonts.has(option.value)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(option.googleFontSpec)}&display=swap`;
    document.head.appendChild(link);
    loadedFonts.add(option.value);
  }

  document.documentElement.style.setProperty("--font-sans", `"${option.value}", ${option.fallback}`);
}
