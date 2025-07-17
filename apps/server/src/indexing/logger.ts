// Minimal leveled logger w/ timestamps
const levels = ["debug", "info", "warn", "error"] as const;
type LogLevel = typeof levels[number];

let current: LogLevel = (process.env.CODEGRAPH_LOG_LEVEL as LogLevel) || "info";

function should(level: LogLevel): boolean {
  return levels.indexOf(level) >= levels.indexOf(current);
}

function log(level: LogLevel, ...args: any[]): void {
  if (!should(level)) return;
  const ts = new Date().toISOString();
  (console[level === "debug" ? "log" : level] as (...args: any[]) => void)(
    `[${ts}] [${level.toUpperCase()}]`,
    ...args
  );
}

export const logger = {
  setLevel(l: LogLevel) {
    if (levels.includes(l)) current = l;
  },
  debug: (...a: any[]) => log("debug", ...a),
  info: (...a: any[]) => log("info", ...a),
  warn: (...a: any[]) => log("warn", ...a),
  error: (...a: any[]) => log("error", ...a),
};

export type { LogLevel };
