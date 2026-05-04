const logger = require("./logger");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { retries = 3, baseDelayMs = 500, label = "operation" } = {}) {
  let attempt = 0;
  // retries is number of *retries after the first attempt*
  const maxAttempts = Math.max(1, retries + 1);

  while (true) {
    attempt += 1;
    try {
      return await fn({ attempt, maxAttempts });
    } catch (error) {
      const isLast = attempt >= maxAttempts;
      logger.warn(`${label} failed`, {
        attempt,
        maxAttempts,
        isLast,
        error: error.message
      });

      if (!error.isTransient) {
        throw error;
      }

      if (isLast) {
        throw error;
      }

      const backoff = baseDelayMs * 2 ** (attempt - 1);
      await sleep(backoff);
    }
  }
}

module.exports = {
  withRetry,
  sleep
};
