/**
 * Minimal dependency-free structured logger.
 *
 * Emits one JSON object per line (picked up verbatim by Vercel / container log
 * drains), supports a bound context (e.g. a request id) via `child`, and
 * redacts obviously-sensitive keys so secrets never reach the logs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const SENSITIVE_KEY =
  /(authorization|cookie|password|passwd|secret|token|api[_-]?key|service[_-]?role|bearer)/i;

function redact(fields?: LogFields): LogFields {
  if (!fields) return {};
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : value;
  }
  return out;
}

function write(level: LogLevel, message: string, context: LogFields, fields?: LogFields) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
    ...redact(fields),
  };
  const line = JSON.stringify(entry);
  // Route to the matching console channel so platforms classify severity.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Returns a new logger that merges the given context into every entry. */
  child(context: LogFields): Logger;
}

export function createLogger(context: LogFields = {}): Logger {
  return {
    debug: (m, f) => write("debug", m, context, f),
    info: (m, f) => write("info", m, context, f),
    warn: (m, f) => write("warn", m, context, f),
    error: (m, f) => write("error", m, context, f),
    child: (extra) => createLogger({ ...context, ...extra }),
  };
}

export const logger = createLogger();
