const path = require("path");
const cors = require("cors");
const express = require("express");
const { connectDb } = require("./config/db");
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

let dbReady;
async function ensureDb(_req, _res, next) {
  try {
    if (!dbReady) {
      dbReady = connectDb();
    }
    await dbReady;
    next();
  } catch (err) {
    next(err);
  }
}

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

const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

const artifactsRoot = path.join(process.cwd(), "artifacts");
app.use(
  "/playwright-artifacts",
  express.static(artifactsRoot, {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    }
  })
);

// Prevent stale HTML from referencing old hashed assets after redeploy.
app.use((req, res, next) => {
  const requestPath = req.path || "";
  const isHtmlEntry = requestPath === "/" || requestPath.endsWith(".html");
  if (isHtmlEntry) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (_req, res) => {
  const indexPath = path.join(publicDir, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      res
        .status(503)
        .type("text")
        .send(
          "UI not found (public/index.html). Check that the Vite build ran and public/ exists in the deployment."
        );
    }
  });
});

app.use("/api", ensureDb);
app.use("/api", provisioningRoutes);

app.use((err, _req, res, _next) => {
  logger.error("http.error", { error: err.message });
  res.status(500).json({
    error: "Internal server error",
    details: err.message
  });
});

module.exports = app;
