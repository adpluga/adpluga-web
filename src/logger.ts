type LogLevel = "debug" | "info" | "warn" | "error";

let enabled = false;
let sink: ((level: LogLevel, msg: string, meta?: unknown) => void) | undefined;

const PREFIX = "[adpluga]";

export function setLoggerEnabled(v: boolean): void {
  enabled = v;
}

export function setLoggerSink(
  fn: ((level: LogLevel, msg: string, meta?: unknown) => void) | undefined,
): void {
  sink = fn;
}

function emit(level: LogLevel, msg: string, meta?: unknown): void {
  if (!enabled && level !== "error") return;
  if (sink) {
    try {
      sink(level, msg, meta);
    } catch {
      // sink must never crash the SDK; swallow.
    }
    return;
  }
  const line = `${PREFIX} ${msg}`;
  if (level === "error") console.error(line, meta ?? "");
  else if (level === "warn") console.warn(line, meta ?? "");
  else if (level === "info") console.info(line, meta ?? "");
  else console.debug(line, meta ?? "");
}

export const log = {
  debug: (msg: string, meta?: unknown) => emit("debug", msg, meta),
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
};
