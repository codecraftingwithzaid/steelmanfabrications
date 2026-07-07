/** Pipeline stage that failed, used for precise server-side diagnostics. */
export type PdfStage = "launch" | "navigate" | "fit" | "render" | "unknown";

/** Typed error carrying the failing stage and the underlying cause. */
export class PdfError extends Error {
  constructor(
    message: string,
    readonly stage: PdfStage,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PdfError";
  }
}
