// The real logic lives in api/_lib/seoText.js so the website and the Vercel functions (sitemap, link
// previews) always build identical Google text. This file only re-exports it for the website code.
export {
  variantSeoTitle,
  variantSeoDescription,
  productTypeWord,
  missingSeoFields,
  categorySeoTitle,
  collectionSeoTitle,
  listingSeoDescription,
  TITLE_CORE_MAX,
  DESC_MAX,
} from "../../api/_lib/seoText.js";
