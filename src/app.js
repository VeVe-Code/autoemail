const cors = require("cors");
const express = require("express");
const provisioningRoutes = require("./routes/provisioningRoutes");
const logger = require("./utils/logger");

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: false
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("http.request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start
    });
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", provisioningRoutes);

app.use((err, _req, res, _next) => {
  logger.error("http.error", { error: err.message });
  res.status(500).json({
    error: "Internal server error",
    details: err.message
  });
});

module.exports = app;
