/**
 * Indian-locale money formatting and amount-in-words.
 *
 * These functions are business-critical: the same rounding and grouping rules
 * are used for the on-screen UI, the PDF template, and (conceptually) the
 * server-side recalculation. Keep this the single source of truth.
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

/** Round to 2 decimals with half-up behaviour, avoiding float drift. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // Adding Number.EPSILON avoids 1.005 -> 1.00 style errors.
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Words for 0..99. */
function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

/** Words for 0..999. */
function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

/**
 * Convert a non-negative integer to words using the Indian numbering system
 * (Thousand / Lakh / Crore). Recurses for the crore group so arbitrarily large
 * values remain correct (e.g. "Twelve Crore Thirty Four Lakh ...").
 */
export function integerToIndianWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const below = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${integerToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (below) parts.push(threeDigitsToWords(below));

  return parts.join(" ").trim();
}

/**
 * Full "Rupees ... Only" phrasing as seen on the reference document, including
 * paise when present.
 */
export function amountToWords(amount: number): string {
  const value = round2(Math.abs(amount));
  let rupees = Math.floor(value);
  let paise = Math.round((value - rupees) * 100);
  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }

  let words = `Rupees ${integerToIndianWords(rupees)}`;
  if (paise > 0) {
    words += ` and ${integerToIndianWords(paise)} Paise`;
  }
  return `${words} Only`;
}

/** Indian digit grouping without a currency symbol, e.g. 120000 -> "1,20,000.00". */
export function formatNumberIN(amount: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(round2(amount));
}

/** Full currency string, e.g. "₹1,20,000.00". Uses a hard ₹ for PDF stability. */
export function formatINR(amount: number, fractionDigits = 2): string {
  return `₹${formatNumberIN(amount, fractionDigits)}`;
}

/**
 * Builds the download file name (without extension) for a document PDF in the
 * form "customername_docnumber", e.g. "Acme Constructions_INV-0042". Strips
 * characters that are illegal in file names and collapses whitespace.
 */
export function pdfFileName(doc: {
  customerName?: string | null;
  docNumber?: string | null;
  docType?: string | null;
}): string {
  const clean = (s: string) =>
    s
      .replace(/[\\/:*?"<>|]+/g, "") // filesystem-illegal characters
      .replace(/\s+/g, " ")
      .trim();

  const name = clean(doc.customerName ?? "");
  const number = clean(doc.docNumber ?? "");
  const base = [name, number].filter(Boolean).join("_");
  return base || clean(doc.docType ?? "") || "document";
}
