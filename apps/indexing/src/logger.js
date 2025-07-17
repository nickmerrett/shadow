// Minimal leveled logger w/ timestamps
const levels = ["debug", "info", "warn", "error"];
let current = process.env.CODEGRAPH_LOG_LEVEL || "info";
function should(level) {
  return levels.indexOf(level) >= levels.indexOf(current);
}

function log(level, ...args) {
  if (!should(level)) return;
  const ts = new Date().toISOString();
  console[level === "debug" ? "log" : level](
    `[${ts}] [${level.toUpperCase()}]`,
    ...args
  );
}

module.exports = {
  setLevel(l) {
    if (levels.includes(l)) current = l;
  },
  debug: (...a) => log("debug", ...a),
  info: (...a) => log("info", ...a),
  warn: (...a) => log("warn", ...a),
  error: (...a) => log("error", ...a),
};
