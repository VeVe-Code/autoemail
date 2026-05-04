const { v4: uuidv4 } = require("uuid");
const env = require("../config/env");
const ProvisionedAccount = require("../models/ProvisionedAccount");
const { generateRandomUser } = require("../utils/randomUser");
const { randomDelay } = require("../utils/delay");
const { createMailbox } = require("./pleskService");
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
  maxRetries = env.pleskMaxRetries,
  retryBaseDelayMs = env.pleskRetryBaseDelayMs,
  includePassword = false
}) {
  const requestId = uuidv4();
  const results = [];

  logger.info("provision.start", {
    requestId,
    count,
    maxRetries,
    retryBaseDelayMs
  });

  for (let i = 0; i < count; i += 1) {
    const user = generateRandomUser();
    const email = `${user.username}@${env.domain}`;

    try {
      const pleskResult = await createMailbox(
        {
          domain: env.domain,
          username: user.username,
          password: user.password
        },
        {
          retries: maxRetries,
          baseDelayMs: retryBaseDelayMs
        }
      );

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
    } catch (error) {
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
    }

    await randomDelay(env.defaultDelayMinMs, env.defaultDelayMaxMs);
  }

  logger.info("provision.done", {
    requestId,
    totalRequested: count,
    totalProcessed: results.length
  });

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
