const { v4: uuidv4 } = require("uuid");
const env = require("../config/env");
const ProvisionedAccount = require("../models/ProvisionedAccount");
const { generateRandomUser } = require("../utils/randomUser");
const { sleep, randomDelay } = require("../utils/delay");
const { createMailbox } = require("./pleskService");
const { createMailboxViaBrowser, closeBrowserSession } = require("./pleskBrowserService");
const logger = require("../utils/logger");

function mapSavedAccount(saved, { includePassword }) {
  const base = {
    id: saved.id,
    email: saved.email,
    username: saved.username,
    status: saved.status
  };

  if (includePassword) {
    return { ...base, password: saved.password };
  }

  return base;
}

async function provisionAccounts({
  count,
  mode = "api",
  pleskHost = env.pleskHost,
  pleskUsername = env.pleskUsername,
  pleskPassword = env.pleskPassword,
  usernameLength = 12,
  passwordLength = 12,
  usernamePrefix = "",
  delayMinMs = env.defaultDelayMinMs,
  delayMaxMs = env.defaultDelayMaxMs,
  maxRetries = env.pleskMaxRetries,
  retryBaseDelayMs = env.pleskRetryBaseDelayMs,
  includePassword = false,
  onLog = () => {}
}) {
  const requestId = uuidv4();
  const results = [];
  const normalizedMode = String(mode || "api").toLowerCase();
  const domain = env.domain;

  logger.info("provision.start", {
    requestId,
    count,
    mode: normalizedMode,
    usernameLength,
    passwordLength,
    usernamePrefix,
    maxRetries,
    retryBaseDelayMs
  });
  onLog(`Mode selected: ${normalizedMode}`);
  onLog(`Domain: ${domain}`);
  onLog(`Preparing to create ${count} mailbox(es)...`);

  const browserSession = normalizedMode === "browser" ? {} : null;
  try {
    for (let i = 0; i < count; i += 1) {
      const user = generateRandomUser({ usernameLength, passwordLength, prefix: usernamePrefix });
      const email = `${user.username}@${domain}`;
      onLog(`Creating ${i + 1}/${count}: ${email}`);

      try {
        let pleskResult;
        if (normalizedMode === "browser") {
          onLog(
            i === 0
              ? "Opening browser and creating mailbox via Plesk UI..."
              : "Reusing logged-in browser session for next mailbox..."
          );
          pleskResult = await createMailboxViaBrowser({
            host: pleskHost,
            username: pleskUsername,
            password: pleskPassword,
            domain,
            mailname: user.username,
            mailboxPassword: user.password
          }, { session: browserSession });
        } else {
          pleskResult = await createMailbox(
            {
              domain,
              username: user.username,
              password: user.password
            },
            {
              retries: maxRetries,
              baseDelayMs: retryBaseDelayMs
            }
          );
        }

        const saved = await ProvisionedAccount.create({
          requestId,
          provider: "plesk",
          email,
          username: user.username,
          password: user.password,
          otpMode: "none",
          status: "created",
          metadata: {
            pleskResult,
            mode: normalizedMode,
            retries: maxRetries,
            retryBaseDelayMs
          }
        });

        logger.info("provision.account.created", {
          requestId,
          email: saved.email,
          username: saved.username,
          retries: maxRetries
        });

        results.push({
          ...mapSavedAccount(saved, { includePassword }),
          retries: maxRetries
        });
        onLog(`Success: ${email}`);
      } catch (error) {
        const isTransient = Boolean(error && error.isTransient);
        if (isTransient && maxRetries > 0) {
          onLog(`Retrying ${email} (transient error): ${error.message}`);
          await sleep(retryBaseDelayMs);
        }

        const failed = await ProvisionedAccount.create({
          requestId,
          provider: "plesk",
          email,
          username: user.username,
          password: user.password,
          otpMode: "none",
          status: "failed",
          errorMessage: error.message,
          metadata: {
            mode: normalizedMode,
            retries: maxRetries,
            retryBaseDelayMs,
            pleskErrcode: error.pleskErrcode,
            pleskXml: error.pleskXml
          }
        });

        logger.error("provision.account.failed", {
          requestId,
          email: failed.email,
          username: failed.username,
          retries: maxRetries,
          error: error.message
        });

        results.push({
          ...mapSavedAccount(failed, { includePassword }),
          retries: maxRetries,
          error: failed.errorMessage
        });
        onLog(`Failed: ${email} (${error.message})`);
      }

      const delayMs = await randomDelay(delayMinMs, delayMaxMs);
      onLog(`Waiting ${delayMs}ms before next request...`);
    }
  } finally {
    if (browserSession) {
      await closeBrowserSession(browserSession);
    }
  }

  logger.info("provision.done", {
    requestId,
    totalRequested: count,
    totalProcessed: results.length
  });
  onLog("Provisioning finished.");

  return {
    requestId,
    totalRequested: count,
    totalProcessed: results.length,
    results
  };
}

module.exports = {
  provisionAccounts
};
