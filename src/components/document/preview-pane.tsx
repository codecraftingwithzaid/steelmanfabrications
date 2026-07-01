"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentPreview } from "./document-preview";
import type { DocumentDraft } from "@/lib/types";

const A4_WIDTH_PX = 794; // 210mm @ 96dpi
const A4_HEIGHT_PX = 1123; // 297mm @ 96dpi

/** Renders the exact A4 preview, scaled down to fit the available width. */
export function PreviewPane({ draft }: { draft: DocumentDraft }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setScale(Math.min(1, w / A4_WIDTH_PX));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
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
