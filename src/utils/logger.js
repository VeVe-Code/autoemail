function log(level, message, fields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields
  };

  // Keep logs machine-parseable without adding extra dependencies.
  console[level === "error" ? "error" : "log"](JSON.stringify(payload));
}

module.exports = {
  info: (msg, fields) => log("info", msg, fields),
  warn: (msg, fields) => log("warn", msg, fields),
  error: (msg, fields) => log("error", msg, fields)
};
