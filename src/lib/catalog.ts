/**
 * Canonical seed catalog for line-item descriptions and units.
 *
 * This mirrors what the SQL seed migration inserts into `item_categories` /
 * `item_descriptions`. The app reads descriptions from Supabase at runtime
 * (so admins can edit them); this file is the authoring source for the seed
 * and a safe offline fallback for the editor.
 */

export type CategorySlug = "fabrication" | "aluminium";

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  fabrication: "Fabrication",
  aluminium: "Aluminium",
};

export const FABRICATION_DESCRIPTIONS: string[] = [
  "MS Grill Work",
  "SS Handrail",
  "MS Staircase Railing",
  "MS Gate Fabrication",
  "MS Window Grill",
  "MS Door Frame",
  "Powder Coating",
  "Welding Work",
  "Labour Charges",
  "Transportation Charges",
];

export const ALUMINIUM_DESCRIPTIONS: string[] = [
  "Balcony SS Railing (SS Studs 304, 50×50mm SS Top 304, 12mm Toughened Glass)",
  "Stairs Glass Railing (SS Studs 304, 50×50mm SS Top 304, 12mm Toughened Glass Railing)",
  "MAAN Aluminium Sliding Windows System (27×65mm Series Domal, 16 Gauge White Powder Coat, 5mm Clear Toughened Glass)",
  "Balcony Slider 6 Shutter Windows (27×65mm Series Domal, 16 Gauge White Powder Coat, 5mm Clear Toughened Glass)",
  "Fixed Glass (40mm Outer Frame, 8mm Clear Toughened Glass)",
  "Openable Windows (40mm Series Openable Frame, 8mm Clear Toughened Glass)",
  "SS Square Pipe Railing",
  "Aluminium Sliding Door",
  "Aluminium Casement Door",
  "Aluminium Partition",
  "Aluminium Curtain Wall",
  "Aluminium Composite Panel (ACP) Cladding",
  "Aluminium Louver",
  "Spider Glass Fitting",
  "Glass Work",
  "Labour Charges",
  "Transportation Charges",
];

export const DESCRIPTIONS_BY_CATEGORY: Record<CategorySlug, string[]> = {
  fabrication: FABRICATION_DESCRIPTIONS,
  aluminium: ALUMINIUM_DESCRIPTIONS,
};

/** Sentinel used in the dropdown to switch a row to a free-text input. */
export const OTHER_OPTION = "__OTHER__";

/** Units available in the line-item Unit dropdown (free text also allowed). */
export const UNITS: string[] = [
  "PCS",
  "FT",
  "SQFT",
  "KG",
  "RFT",
  "NOS",
  "SET",
  "MTR",
  "LOT",
];

export const GST_QUICK_SLABS = [0, 5, 12, 18, 28] as const;

/** Company profile shown on-screen and in the PDF header. */
export const COMPANY = {
  name: "Steelman Fabrication & Aluminium Windows Works",
  addressLines: [
    "8, Sanvid Nagar Kanadiya Road Near Masjid,",
    "Indore (MP) 452018",
  ],
  phone: "9111677776",
} as const;

export const DEFAULT_TERMS =
  "1. This is an electronically generated document.\n2. All Freight and Cartage Extra.";
