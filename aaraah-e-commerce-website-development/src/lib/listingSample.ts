import * as XLSX from "xlsx";

/**
 * The AARAAH listing sheet (Uploader.xlsx format) as a ready-to-fill sample.
 * Column headers here MUST stay identical to the ones the importer reads (src/pages/admin/ImportPage.tsx).
 * Sheet "Template" = what you fill and upload. Sheet "Details" = what each column means.
 * The two example rows use SKUs that start with EXAMPLE- : the importer ignores such rows, so they can never
 * be imported by accident (delete them anyway).
 */

/** Row 1 of the Template sheet, in order. "Other Image URL" repeats 6 times and "Bullet Point" 5 times. */
export const LISTING_HEADERS: string[] = [
  "SKU",
  "Parentage Level",
  "Parent SKU",
  "Item Name",
  "Product Type",
  "Main Image URL",
  ...Array(6).fill("Other Image URL"),
  ...Array(5).fill("Bullet Point"),
  "MRP",
  "Selling Price",
  "Discount %",
  "Discount Amount",
  "Stock",
  "Map Color",
  "Main Color",
  "Product Description",
  "Work Type",
  "Work Pattern",
  "Best For",
  "Manufacturer",
  "Included Components",
  "Fabric Type",
  "Generic Keywords",
];

/** SKUs starting with this are example rows and are skipped by the importer. */
export const EXAMPLE_SKU_PREFIX = "EXAMPLE-";

function row(values: Record<string, string | number | string[]>): (string | number)[] {
  const used: Record<string, number> = {};
  return LISTING_HEADERS.map((h) => {
    const v = values[h];
    if (Array.isArray(v)) {
      const i = used[h] ?? 0;
      used[h] = i + 1;
      return v[i] ?? "";
    }
    return v ?? "";
  });
}

const DETAILS: string[][] = [
  ["Column", "Zaroori?", "Kya likhna hai", "Example"],
  ["SKU", "HAAN", "Har row ka apna alag SKU (Parent ka bhi, Child ka bhi). Dobara wahi SKU = us colour ka update.", "SAREE-001-RED"],
  ["Parentage Level", "HAAN", "Sirf: Parent ya Child. Parent = design (naam ke liye), Child = ek colour jo customer kharid sakta hai.", "Child"],
  ["Parent SKU", "Child me HAAN", "Child row me uske Parent ka SKU. Parent row me khali chhodo. Same Parent SKU = usi design me naya colour.", "SAREE-001"],
  ["Item Name", "Parent me HAAN", "Design ka naam (website par yahi dikhta hai). Sirf Parent row me bharna kaafi hai.", "Kanjivaram Silk Saree"],
  ["Product Type", "HAAN (Child ki pehli row me)", "Category: SAREE, KURTA SET, LEHENGA, DUPATTA, BOTTOMWEAR, BLOUSE. Ye na mile to product skip hota hai.", "SAREE"],
  ["Main Image URL", "HAAN", "Pehli (cover) photo ka seedha link (.jpg/.png/.webp). Drive ya page ka link nahi.", "https://.../red-1.jpg"],
  ["Other Image URL (6 columns)", "Nahi", "Aur photos, har column me ek link, left se right order me.", ""],
  ["Bullet Point (5 columns)", "Nahi", "Product ke khaas points, har column me ek.", "Pure silk, zari border"],
  ["MRP", "HAAN", "MRP (0 se zyada). Khali ya 0 ho to wo colour import nahi hoga.", "4999"],
  ["Selling Price", "Nahi", "Asli bikri ka daam (MRP se zyada nahi). Khali = koi discount nahi.", "2999"],
  ["Discount %", "Nahi", "Optional.", ""],
  ["Discount Amount", "Nahi", "Optional.", ""],
  ["Stock", "Nahi", "Kitne piece. Naye SKU me khali = 0. Purane SKU me khali = purana stock jaisa tha waisa hi rahega.", "5"],
  ["Map Color", "HAAN", "Colour ka naam jo customer ko dikhta hai.", "Red"],
  ["Main Color", "Nahi", "Colour group (andar ke liye).", "Red"],
  ["Product Description", "Nahi", "Is colour ka description.", ""],
  ["Work Type", "Nahi", "", "Zari"],
  ["Work Pattern", "Nahi", "", "Woven"],
  ["Best For", "Nahi", "", "Wedding"],
  ["Manufacturer", "Nahi", "", "AARAAH"],
  ["Included Components", "Nahi", "", "Saree with blouse piece"],
  ["Fabric Type", "Nahi", "", "Silk"],
  ["Generic Keywords", "Nahi", "Search ke liye shabd.", "silk saree, kanjivaram"],
  ["", "", "", ""],
  ["IMPORTANT", "", "Template sheet ki pehli row (headers) kabhi mat badlo. EXAMPLE- wale 2 rows delete kar do (ya rehne do: import unhe skip karta hai).", ""],
];

/** The sample workbook (sheets "Template" and "Details"). */
export function buildListingSampleWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const template = XLSX.utils.aoa_to_sheet([
    LISTING_HEADERS,
    row({ SKU: `${EXAMPLE_SKU_PREFIX}SAREE-001`, "Parentage Level": "Parent", "Item Name": "Kanjivaram Silk Saree (example - delete)", "Product Type": "SAREE" }),
    row({
      SKU: `${EXAMPLE_SKU_PREFIX}SAREE-001-RED`,
      "Parentage Level": "Child",
      "Parent SKU": `${EXAMPLE_SKU_PREFIX}SAREE-001`,
      "Product Type": "SAREE",
      "Main Image URL": "https://example.com/red-1.jpg",
      "Other Image URL": ["https://example.com/red-2.jpg", "https://example.com/red-3.jpg"],
      "Bullet Point": ["Pure silk", "Zari border"],
      MRP: 4999,
      "Selling Price": 2999,
      Stock: 5,
      "Map Color": "Red",
      "Main Color": "Red",
      "Product Description": "Example description",
      "Fabric Type": "Silk",
    }),
  ]);
  template["!cols"] = LISTING_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, template, "Template");

  const details = XLSX.utils.aoa_to_sheet(DETAILS);
  details["!cols"] = [{ wch: 28 }, { wch: 26 }, { wch: 90 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, details, "Details");
  return wb;
}

/** Downloads the sample as AARAAH-listing-sample.xlsx. */
export function downloadListingSample(): void {
  XLSX.writeFile(buildListingSampleWorkbook(), "AARAAH-listing-sample.xlsx");
}
