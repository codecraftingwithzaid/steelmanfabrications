"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentPreview } from "./document-preview";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentDraft } from "@/lib/types";

const A4_WIDTH_PX = 794; // 210mm @ 96dpi
const A4_HEIGHT_PX = 1123; // 297mm @ 96dpi

/** Renders the exact A4 preview, scaled down to fit the available width. */
export function PreviewPane({ draft }: { draft: DocumentDraft }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setScale(Math.min(1, w / A4_WIDTH_PX));
    });
    ro.observe(el);

    // Reveal once the shrink-to-fit density has settled the first time.
    const check = () => {
      if (el.querySelector('[data-doc-page][data-ready="1"]')) setReady(true);
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(el, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-ready"],
    });
    const fallback = setTimeout(() => setReady(true), 1500);

    return () => {
      ro.disconnect();
      mo.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden">
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-card/70 backdrop-blur-sm">
          <Spinner className="size-7" />
        </div>
      )}
      <div style={{ height: `${A4_HEIGHT_PX * scale}px` }}>
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: A4_WIDTH_PX,
          }}
        >
          <DocumentPreview draft={draft} />
        </div>
      </div>
    </div>
  );
}
