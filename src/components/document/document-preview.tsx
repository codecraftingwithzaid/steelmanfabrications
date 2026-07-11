"use client";

import * as React from "react";
import { COMPANY } from "@/lib/catalog";
import { computeTotals } from "@/lib/calc";
import { amountToWords, formatNumberIN, formatDateDMY } from "@/lib/format";
import { nextDensity } from "@/lib/fit-to-page";
import type { DocumentDraft } from "@/lib/types";

interface Props {
  draft: DocumentDraft;
  /** When true, strips the on-screen frame/shadow for pixel-clean PDF capture. */
  printMode?: boolean;
  /** Called once the density has settled and the page fits on one A4 sheet. */
  onFitted?: () => void;
}

const BASE_FONT_PX = 12.5;

/* ---------------------------------------------------------------------------
 * Engineering-spec-sheet design tokens. Hard-coded (not theme vars) so the
 * printed document is always neutral paper regardless of app light/dark mode.
 * ------------------------------------------------------------------------- */
const PAPER = "#ffffff";
const INK = "#161616"; // near-black primary text
const SECONDARY = "#454a52"; // mid-grey
const MUTED = "#9aa1ab"; // light-grey
const HAIRLINE = "#dcdfe4"; // 0.5–1px hairline borders
const HEAVY = "#161616"; // heavier border (grand total + title block)
const AMBER = "#b45309"; // single accent — badge, GRAND TOTAL, stamp
const AMBER_BG = "rgba(217, 119, 6, 0.12)";
const AMBER_BORDER = "rgba(180, 83, 9, 0.55)";

const OSWALD = "var(--font-oswald), 'Oswald', sans-serif";
const MONO = "var(--font-plex-mono), 'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'Helvetica Neue', Arial, sans-serif";

/* ---------------------------------------------------------------------------
 * Header brand styling — centralized so company-name emphasis can be tuned in
 * one place. Sizes are `em`-relative to the page base font so they scale with
 * the shrink-to-fit density. At base density the name renders ~20pt and the
 * detail lines ~10pt, preserving a clear hierarchy: NAME > tagline > details.
 * ------------------------------------------------------------------------- */
// The branding sits on a solid amber "plate" so it reads as highlighted and
// balances the document-type badge on the opposite side of the header.
const COMPANY_LOCKUP_STYLE: React.CSSProperties = {
  display: "inline-block",
  background: AMBER, // brand accent fill (the highlight)
  padding: "0.32em 0.72em",
  borderRadius: "4px",
};
const COMPANY_NAME_STYLE: React.CSSProperties = {
  fontFamily: OSWALD,
  fontWeight: 700,
  fontSize: "2.1em", // dominant — ~20pt at base density
  lineHeight: 1,
  letterSpacing: "0.14em",
  color: "#ffffff", // on the amber highlight
};
const COMPANY_TAGLINE_STYLE: React.CSSProperties = {
  fontFamily: OSWALD,
  fontWeight: 600,
  fontSize: "0.82em",
  letterSpacing: "0.14em",
  color: "rgba(255, 255, 255, 0.9)",
  marginTop: "0.25em",
};
const COMPANY_DETAILS_STYLE: React.CSSProperties = {
  color: SECONDARY,
  fontSize: "0.82em",
  marginTop: "0.5em",
  lineHeight: 1.45,
};

function fmtQty(qty: string): string {
  const n = Number(qty);
  if (!Number.isFinite(n) || n === 0) return qty || "";
  // trim trailing zeros but keep meaningful decimals
  return String(Number(n.toFixed(3)));
}

function makeSignature(d: DocumentDraft): string {
  return JSON.stringify({
    t: d.docType,
    n: d.docNumber,
    dt: d.docDate,
    v: d.validityOrDueDate,
    c: d.customerName,
    ph: d.customerPhone,
    ad: d.customerAddress,
    g: d.gstPercent,
    adv: d.advancePayment,
    items: d.items.map((i) => [i.description, i.qty, i.unit, i.rate]),
    terms: d.terms,
    ct: [d.contact.name, d.contact.email, d.contact.phone],
  });
}

export function DocumentPreview({ draft, printMode = false, onFitted }: Props) {
  const pageRef = React.useRef<HTMLDivElement>(null);
  const itemsWrapRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const sigRef = React.useRef<string>("");
  const [scale, setScale] = React.useState(1);

  const signature = makeSignature(draft);

  const totals = computeTotals(
    draft.items.map((i) => ({ qty: Number(i.qty), rate: Number(i.rate) })),
    draft.gstPercent === "" ? null : Number(draft.gstPercent),
  );
  const advance = Math.max(0, Number(draft.advancePayment) || 0);
  const hasAdvance = advance > 0;
  const balanceDue = totals.grandTotal - advance;

  React.useLayoutEffect(() => {
    // Reset density when the document content changes, then step down to fit.
    if (sigRef.current !== signature) {
      sigRef.current = signature;
      pageRef.current?.removeAttribute("data-ready");
      if (scale !== 1) {
        setScale(1);
        return;
      }
    }

    const wrap = itemsWrapRef.current;
    const table = tableRef.current;
    if (!wrap || !table) return;

    const overflowing = table.scrollHeight > wrap.clientHeight + 1;
    const next = nextDensity(overflowing, scale);
    if (next !== null) {
      setScale(next);
    } else {
      pageRef.current?.setAttribute("data-ready", "1");
      onFitted?.();
    }
  }, [signature, scale, onFitted]);

  const isInvoice = draft.docType === "invoice";
  const badgeText = isInvoice ? "INVOICE" : "QUOTATION";
  const thirdLabel = isInvoice ? "DUE DATE" : "VALIDITY";
  const clientLabel = isInvoice ? "BILL TO" : "QUOTATION FOR / SITE";
  const gstin = draft.customerGstin.trim() || "URP";
  const hasGst = draft.gstPercent !== "" && Number(draft.gstPercent) > 0;

  // Base font scales with density; paddings use em so they scale together.
  const pageStyle: React.CSSProperties = {
    fontSize: `${BASE_FONT_PX * scale}px`,
  };

  const rows =
    draft.items.length > 0
      ? draft.items
      : [
          {
            key: "empty",
            description: "",
            qty: "",
            unit: "",
            rate: "",
          } as DocumentDraft["items"][number],
        ];

  return (
    <div
      ref={pageRef}
      className="doc-page"
      data-doc-page
      style={{
        width: "210mm",
        minHeight: "297mm",
        height: "297mm",
        padding: "10mm",
        boxSizing: "border-box",
        background: PAPER,
        color: INK,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: SANS,
        lineHeight: 1.3,
        ...pageStyle,
        ...(printMode ? {} : { border: `1px solid ${HAIRLINE}` }),
      }}
    >
      {/* ===================== TOP GROUP (fixed height) ===================== */}
      <div style={{ flex: "0 0 auto" }}>
        {/* ------------------------- HEADER ------------------------- */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1em",
            breakInside: "avoid",
          }}
        >
          <div style={{ maxWidth: "62%" }}>
            <div style={COMPANY_LOCKUP_STYLE}>
              <div style={COMPANY_NAME_STYLE}>STEELMAN</div>
              <div style={COMPANY_TAGLINE_STYLE}>
                FABRICATION &amp; ALUMINIUM WINDOWS WORKS
              </div>
            </div>
            <div style={COMPANY_DETAILS_STYLE}>
              {COMPANY.addressLines.map((l) => (
                <div key={l}>{l}</div>
              ))}
              <div style={{ fontFamily: MONO }}>Ph {COMPANY.phone}</div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "0.6em",
            }}
          >
            <span
              style={{
                fontFamily: OSWALD,
                fontWeight: 600,
                fontSize: "1.15em",
                letterSpacing: "0.18em",
                color: AMBER,
                background: AMBER_BG,
                border: `1px solid ${AMBER_BORDER}`,
                borderRadius: "4px",
                padding: "0.25em 0.9em",
              }}
            >
              {badgeText}
            </span>
            <table
              style={{
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                fontSize: "0.8em",
                borderCollapse: "collapse",
              }}
            >
              <tbody>
                <MetaRow label="DOC NO" value={draft.docNumber || "—"} />
                <MetaRow label="DATE" value={formatDateDMY(draft.docDate) || "—"} />
                {/* Invoices omit the due-date row; quotations keep validity. */}
                {!isInvoice && (
                  <MetaRow
                    label={thirdLabel}
                    value={formatDateDMY(draft.validityOrDueDate) || "—"}
                  />
                )}
              </tbody>
            </table>
          </div>
        </header>

        {/* --------------------- RULER-TICK DIVIDER --------------------- */}
        <RulerTick />

        {/* ----------------------- CLIENT / SITE ----------------------- */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1.5em",
            marginTop: "0.5em",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldLabel>{clientLabel}</FieldLabel>
            <div
              style={{ fontWeight: 700, fontSize: "1.02em", marginTop: "0.1em" }}
            >
              {draft.customerName || "—"}
            </div>
            {draft.customerAddress.trim() && (
              <div
                style={{
                  color: SECONDARY,
                  fontSize: "0.85em",
                  whiteSpace: "pre-line",
                  marginTop: "0.1em",
                }}
              >
                {draft.customerAddress}
              </div>
            )}
            {draft.customerPhone.trim() && (
              <div
                style={{
                  color: SECONDARY,
                  fontSize: "0.85em",
                  fontFamily: MONO,
                }}
              >
                Ph {draft.customerPhone}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <FieldLabel>GSTIN</FieldLabel>
            <div
              style={{
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                fontSize: "0.95em",
                marginTop: "0.1em",
              }}
            >
              {gstin}
            </div>
          </div>
        </div>
      </div>

      {/* ===================== LINE ITEMS (flex-grow) ===================== */}
      <div
        ref={itemsWrapRef}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          marginTop: "0.6em",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <table
          ref={tableRef}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "1em",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f4f5f6",
                borderTop: `1px solid ${HAIRLINE}`,
                borderBottom: `1px solid ${HAIRLINE}`,
              }}
            >
              <Th style={{ width: "7%", textAlign: "center" }}>SR</Th>
              <Th>NAME OF PRODUCT</Th>
              <Th style={{ width: "10%", textAlign: "right" }}>QTY</Th>
              <Th style={{ width: "10%", textAlign: "center" }}>UNIT</Th>
              <Th style={{ width: "16%", textAlign: "right" }}>RATE</Th>
              <Th style={{ width: "18%", textAlign: "right" }}>TOTAL</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, idx) => {
              const q = Number(item.qty);
              const r = Number(item.rate);
              const total =
                Number.isFinite(q) && Number.isFinite(r) ? q * r : 0;
              const filled = item.description || item.qty || item.rate;
              return (
                <tr key={item.key} style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                  <Td
                    style={{
                      textAlign: "center",
                      fontFamily: MONO,
                      color: MUTED,
                    }}
                  >
                    {filled ? String(idx + 1).padStart(2, "0") : ""}
                  </Td>
                  <Td>{item.description}</Td>
                  <Td style={{ textAlign: "right", fontFamily: MONO }} numeric>
                    {fmtQty(item.qty)}
                  </Td>
                  <Td style={{ textAlign: "center", fontFamily: MONO }}>
                    {item.unit}
                  </Td>
                  <Td style={{ textAlign: "right", fontFamily: MONO }} numeric>
                    {item.rate === "" ? "" : formatNumberIN(r)}
                  </Td>
                  <Td style={{ textAlign: "right", fontFamily: MONO }} numeric>
                    {item.description || item.rate ? formatNumberIN(total) : ""}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* flexible spacer keeps footer anchored to the bottom of the page */}
        <div style={{ flex: "1 1 auto" }} />
      </div>

      {/* ======================= FOOTER (fixed) ======================= */}
      <footer style={{ flex: "0 0 auto", marginTop: "0.5em" }}>
        {/* ---------------- Amount in words + totals ---------------- */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderTop: `1px solid ${HAIRLINE}`,
            paddingTop: "0.6em",
            gap: "1.5em",
            breakInside: "avoid",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldLabel>Amount In Words</FieldLabel>
            <div
              style={{
                color: INK,
                maxWidth: "95%",
                marginTop: "0.15em",
                fontSize: "0.92em",
              }}
            >
              {amountToWords(hasAdvance ? balanceDue : totals.grandTotal)}
            </div>
          </div>

          <div style={{ minWidth: "44%" }}>
            <table
              style={{
                width: "100%",
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                borderCollapse: "collapse",
                fontSize: "0.92em",
              }}
            >
              <tbody>
                <TotalRow
                  label="SUBTOTAL"
                  value={`₹ ${formatNumberIN(totals.subtotal)}`}
                />
                {hasGst && (
                  <TotalRow
                    label={`GST @ ${Number(draft.gstPercent)}%`}
                    value={`₹ ${formatNumberIN(totals.gstAmount)}`}
                  />
                )}
              </tbody>
            </table>

            {/* Grand Total — bordered (not filled) box */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "1em",
                marginTop: "0.5em",
                border: `1.5px solid ${HEAVY}`,
                padding: "0.4em 0.7em",
              }}
            >
              <span
                style={{
                  fontFamily: OSWALD,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  color: AMBER,
                  fontSize: "0.95em",
                }}
              >
                GRAND TOTAL
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 600,
                  fontSize: "1.35em",
                  whiteSpace: "nowrap",
                }}
              >
                ₹ {formatNumberIN(totals.grandTotal)}
              </span>
            </div>

            {/* Advance received + balance due (only when an advance is set) */}
            {hasAdvance && (
              <>
                <table
                  style={{
                    width: "100%",
                    fontFamily: MONO,
                    fontVariantNumeric: "tabular-nums",
                    borderCollapse: "collapse",
                    fontSize: "0.92em",
                    marginTop: "0.5em",
                  }}
                >
                  <tbody>
                    <TotalRow
                      label="ADVANCE PAID"
                      value={`- ₹ ${formatNumberIN(advance)}`}
                    />
                  </tbody>
                </table>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "1em",
                    marginTop: "0.4em",
                    border: `1.5px solid ${HEAVY}`,
                    padding: "0.4em 0.7em",
                  }}
                >
                  <span
                    style={{
                      fontFamily: OSWALD,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      color: AMBER,
                      fontSize: "0.95em",
                    }}
                  >
                    BALANCE DUE
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      fontSize: "1.35em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ₹ {formatNumberIN(balanceDue)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ------------- Terms/contact  |  title block/stamp ------------- */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1.5em",
            marginTop: "0.8em",
          }}
        >
          {/* Left column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldLabel>Terms &amp; Conditions</FieldLabel>
            <div
              style={{
                color: SECONDARY,
                whiteSpace: "pre-line",
                fontSize: "0.85em",
                marginTop: "0.15em",
                lineHeight: 1.5,
              }}
            >
              {draft.terms}
            </div>

            <div style={{ marginTop: "0.9em", breakInside: "avoid" }}>
              <FieldLabel>Contact Person</FieldLabel>
              <div
                style={{ fontWeight: 700, fontSize: "0.9em", marginTop: "0.1em" }}
              >
                {draft.contact.name || "—"}
              </div>
              <div
                style={{
                  color: SECONDARY,
                  fontSize: "0.82em",
                  fontFamily: MONO,
                }}
              >
                {COMPANY.email}
              </div>
              <div
                style={{
                  color: SECONDARY,
                  fontSize: "0.82em",
                  fontFamily: MONO,
                }}
              >
                {COMPANY.phone}
              </div>
            </div>
          </div>

          {/* Right column — blueprint title block + stamp + signature */}
          <div
            style={{
              width: "44%",
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              breakInside: "avoid",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: MONO,
                fontSize: "0.78em",
                border: `1.5px solid ${HEAVY}`,
              }}
            >
              <tbody>
                <TitleBlockRow
                  label="DOCUMENT"
                  value={isInvoice ? "INVOICE" : "QUOTATION"}
                />
                <TitleBlockRow label="REV" value="00" />
                <TitleBlockRow
                  label="PREPARED BY"
                  value={draft.contact.name || "—"}
                  last
                />
              </tbody>
            </table>

            {/* Stamp + signature */}
            <div
              style={{
                position: "relative",
                marginTop: "0.7em",
                minHeight: "4.6em",
              }}
            >
              <div
                style={{
                  fontFamily: OSWALD,
                  fontWeight: 600,
                  fontSize: "0.85em",
                  color: INK,
                  textAlign: "right",
                }}
              >
                For, {COMPANY.name}
              </div>

              <div
                style={{
                  marginTop: "3.2em",
                  borderTop: `1px solid ${HEAVY}`,
                  paddingTop: "0.2em",
                  textAlign: "right",
                  fontFamily: OSWALD,
                  fontWeight: 500,
                  fontSize: "0.8em",
                  letterSpacing: "0.08em",
                  color: SECONDARY,
                }}
              >
                AUTHORIZED SIGNATURE
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------ subcomponents ------------------------------ */

function RulerTick() {
  // Full-width hairline tick strip. userSpaceOnUse patterns keep tick spacing
  // constant (~8px) regardless of the rendered container width.
  return (
    <svg
      width="100%"
      height="18"
      style={{ display: "block", marginTop: "0.6em" }}
      aria-hidden
    >
      <defs>
        <pattern
          id="ruler-tick-sm"
          width="8"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0.5" y1="11" x2="0.5" y2="18" stroke={HAIRLINE} strokeWidth="1" />
        </pattern>
        <pattern
          id="ruler-tick-lg"
          width="40"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0.5" y1="5" x2="0.5" y2="18" stroke={MUTED} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="18" fill="url(#ruler-tick-sm)" />
      <rect width="100%" height="18" fill="url(#ruler-tick-lg)" />
      <line x1="0" y1="18" x2="100%" y2="18" stroke={HEAVY} strokeWidth="1" />
    </svg>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: OSWALD,
        fontWeight: 600,
        fontSize: "0.66em",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: MUTED,
      }}
    >
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          color: MUTED,
          padding: "0.12em 0.7em 0.12em 0",
          textAlign: "left",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "0.12em 0", textAlign: "right", color: INK }}>
        {value}
      </td>
    </tr>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          padding: "0.22em 0.7em 0.22em 0",
          color: SECONDARY,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "0.22em 0",
          textAlign: "right",
          whiteSpace: "nowrap",
          color: INK,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function TitleBlockRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const cell: React.CSSProperties = {
    padding: "0.3em 0.55em",
    borderBottom: last ? "none" : `1px solid ${HAIRLINE}`,
    verticalAlign: "middle",
  };
  return (
    <tr>
      <td
        style={{
          ...cell,
          color: MUTED,
          letterSpacing: "0.08em",
          borderRight: `1px solid ${HAIRLINE}`,
          width: "42%",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </td>
      <td style={{ ...cell, color: INK, textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </td>
    </tr>
  );
}

function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "0.5em 0.6em",
        fontFamily: MONO,
        fontWeight: 600,
        fontSize: "0.78em",
        letterSpacing: "0.1em",
        color: SECONDARY,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
  numeric = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  numeric?: boolean;
}) {
  return (
    <td
      style={{
        padding: "0.4em 0.6em",
        verticalAlign: "top",
        color: INK,
        ...(numeric ? { fontVariantNumeric: "tabular-nums" } : {}),
        ...style,
      }}
    >
      {children}
    </td>
  );
}
