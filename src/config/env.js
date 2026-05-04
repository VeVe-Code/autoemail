const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function stripQuotes(value) {
  if (value === undefined || value === null) {
    return value;
  }

  let s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1);
  }

  return s;
}

const env = {
  port: Number(process.env.PORT || 3000),

  mongodbUri:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test_user_provisioner",

  defaultDelayMinMs: Number(process.env.DEFAULT_DELAY_MIN_MS || 700),
  defaultDelayMaxMs: Number(process.env.DEFAULT_DELAY_MAX_MS || 2200),

  // Plesk config
  domain: stripQuotes(process.env.DOMAIN),
  pleskSiteId: process.env.PLESK_SITE_ID
    ? Number(process.env.PLESK_SITE_ID)
    : undefined,
  pleskHost: stripQuotes(process.env.PLESK_HOST),
  pleskUsername: stripQuotes(process.env.PLESK_USERNAME),
  pleskPassword: stripQuotes(process.env.PLESK_PASSWORD),
  pleskKey: stripQuotes(process.env.PLESK_KEY),
  pleskPacketVersion: process.env.PLESK_PACKET_VERSION || "1.6.9.1",
  pleskAuthMethod: (process.env.PLESK_AUTH_METHOD || "plain").toLowerCase(),

  pleskMaxRetries: Number(process.env.PLESK_MAX_RETRIES || 3),
  pleskRetryBaseDelayMs: Number(process.env.PLESK_RETRY_BASE_DELAY_MS || 500),
  // Render/production has no X server, so browser automation must be headless by default.
  pleskBrowserHeadless: String(
    process.env.PLESK_BROWSER_HEADLESS ||
      process.env.HEADLESS ||
      (process.env.NODE_ENV === "production" || process.env.RENDER ? "true" : "false")
  ).toLowerCase() === "true",
  pleskBrowserSlowMoMs: Number(process.env.PLESK_BROWSER_SLOWMO_MS || 120),
  pleskBrowserVisualPauseMs: Number(process.env.PLESK_BROWSER_VISUAL_PAUSE_MS || 1200),
  pleskBrowserTypeDelayMs: Number(process.env.PLESK_BROWSER_TYPE_DELAY_MS || 70)
};

module.exports = env;