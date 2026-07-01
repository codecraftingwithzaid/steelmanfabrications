"use client";

import * as React from "react";
import { COMPANY } from "@/lib/catalog";
import { computeTotals } from "@/lib/calc";
import { amountToWords, formatNumberIN } from "@/lib/format";
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
    c: d.customerName,
    g: d.gstPercent,
    items: d.items.map((i) => [i.description, i.qty, i.unit, i.rate]),
    terms: d.terms,
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
  const title = isInvoice ? "INVOICE" : "QUOTATION";
  const noLabel = isInvoice ? "Invoice No" : "Quotation No";
  const dateLabel = "Date";
  const thirdLabel = isInvoice ? "Due Date" : "Validity";
  const forLabel = isInvoice ? "Invoice For" : "Quotation For";
  const gstin = draft.customerGstin.trim() || "URP";

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
        background: "#ffffff",
        color: "#111827",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        lineHeight: 1.3,
        ...pageStyle,
        ...(printMode
          ? {}
          : {
              boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
              borderRadius: 4,
            }),
      }}
    >
      {/* ============================ HEADER ============================ */}
      <header style={{ borderBottom: "2px solid #111827", paddingBottom: "0.6em" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1em",
          }}
        >
          <div style={{ maxWidth: "62%" }}>
            <div
              style={{
                fontSize: "1.05em",
                fontWeight: 800,
                letterSpacing: "0.02em",
                lineHeight: 1.15,
              }}
            >
              {COMPANY.name}
            </div>
            {COMPANY.addressLines.map((l) => (
              <div key={l} style={{ color: "#374151" }}>
                {l}
              </div>
            ))}
            <div style={{ color: "#374151" }}>{COMPANY.phone}</div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "1.8em",
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: "#c2410c",
              }}
            >
              {title}
            </div>
            <table style={{ marginLeft: "auto", marginTop: "0.4em" }}>
              <tbody>
                <MetaRow label={noLabel} value={draft.docNumber || "—"} />
                <MetaRow label={dateLabel} value={draft.docDate || "—"} />
                <MetaRow
                  label={thirdLabel}
                  value={draft.validityOrDueDate || "—"}
                />
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "0.6em",
            gap: "1em",
          }}
        >
          <div>
            <span style={{ fontWeight: 700 }}>{forLabel}: </span>
            <span>{draft.customerName || "—"}</span>
          </div>
          <div>
            <span style={{ fontWeight: 700 }}>GSTIN: </span>
            <span>{gstin}</span>
          </div>
        </div>
      </header>

      {/* ========================= LINE ITEMS ========================== */}
      <div
        ref={itemsWrapRef}
        style={{
          flex: "1 1 auto",
          overflow: "hidden",
          marginTop: "0.5em",
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
            <tr style={{ background: "#111827", color: "#fff" }}>
              <Th style={{ width: "8%", textAlign: "center" }}>SR NO.</Th>
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
              return (
                <tr key={item.key} style={{ borderBottom: "1px solid #d1d5db" }}>
                  <Td style={{ textAlign: "center" }}>
                    {item.description || item.qty || item.rate ? idx + 1 : ""}
                  </Td>
                  <Td>{item.description}</Td>
                  <Td style={{ textAlign: "right" }}>{fmtQty(item.qty)}</Td>
                  <Td style={{ textAlign: "center" }}>{item.unit}</Td>
                  <Td style={{ textAlign: "right" }}>
                    {item.rate === "" ? "" : formatNumberIN(r)}
                  </Td>
                  <Td style={{ textAlign: "right" }}>
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

      {/* =========================== FOOTER ============================ */}
      <footer style={{ breakInside: "avoid", marginTop: "0.4em" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderTop: "2px solid #111827",
            paddingTop: "0.5em",
            gap: "1em",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Amount In Words</div>
            <div style={{ color: "#374151", maxWidth: "95%" }}>
              {amountToWords(totals.grandTotal)}
            </div>
          </div>
          <table style={{ minWidth: "42%" }}>
            <tbody>
              <TotalRow
                label="Subtotal"
                value={`₹ ${formatNumberIN(totals.subtotal)}`}
              />
              {draft.gstPercent !== "" && Number(draft.gstPercent) > 0 && (
                <TotalRow
                  label={`GST @ ${Number(draft.gstPercent)}%`}
                  value={`₹ ${formatNumberIN(totals.gstAmount)}`}
                />
              )}
              <tr>
                <td
                  style={{
                    fontWeight: 800,
                    fontSize: "1.15em",
                    padding: "0.35em 0.6em 0.35em 0",
                    borderTop: "1px solid #111827",
                  }}
                >
                  Total Amount
                </td>
                <td
                  style={{
                    fontWeight: 800,
                    fontSize: "1.15em",
                    textAlign: "right",
                    padding: "0.35em 0",
                    borderTop: "1px solid #111827",
                    whiteSpace: "nowrap",
                  }}
                >
                  ₹ {formatNumberIN(totals.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "0.6em" }}>
          <div style={{ fontWeight: 700 }}>Terms And Conditions :</div>
          <div style={{ color: "#374151", whiteSpace: "pre-line" }}>
            {draft.terms}
          </div>
        </div>

        <div style={{ marginTop: "0.6em", color: "#374151" }}>
          If you have any questions concerning this{" "}
          {isInvoice ? "invoice" : "quotation"}, please reach{" "}
          {draft.contact.name || "our contact person"}.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "0.8em",
            gap: "1em",
          }}
        >
          <div style={{ fontSize: "0.92em" }}>
            <div
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#6b7280",
                fontSize: "0.85em",
              }}
            >
              Contact Person
            </div>
            <div style={{ fontWeight: 700 }}>{draft.contact.name || "—"}</div>
            <div>{draft.contact.email}</div>
            <div>{draft.contact.phone}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>For, {COMPANY.name}</div>
            <div style={{ height: "2.4em" }} />
            <div style={{ borderTop: "1px solid #111827", paddingTop: "0.2em" }}>
              Authorized Signature
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ fontWeight: 600, padding: "0.1em 0.6em 0.1em 0", textAlign: "left" }}>
        {label}
      </td>
      <td style={{ padding: "0.1em 0", textAlign: "left" }}>: {value}</td>
    </tr>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "0.2em 0.6em 0.2em 0" }}>{label}</td>
      <td style={{ padding: "0.2em 0", textAlign: "right", whiteSpace: "nowrap" }}>
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
        padding: "0.45em 0.6em",
        fontSize: "0.9em",
        letterSpacing: "0.03em",
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
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "0.4em 0.6em",
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
