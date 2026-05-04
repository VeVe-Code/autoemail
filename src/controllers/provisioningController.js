const { provisionAccounts } = require("../services/accountProvisioningService");
const {
  createJob,
  appendLog,
  finishJob,
  failJob,
  getJobSnapshot
} = require("../services/provisioningJobStore");

function validateRequest(body) {
  const count = Number(body.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    return "count must be an integer between 1 and 20";
  }

  if (body.maxRetries !== undefined) {
    const maxRetries = Number(body.maxRetries);
    if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 10) {
      return "maxRetries must be an integer between 0 and 10";
    }
  }

  if (body.retryBaseDelayMs !== undefined) {
    const retryBaseDelayMs = Number(body.retryBaseDelayMs);
    if (!Number.isInteger(retryBaseDelayMs) || retryBaseDelayMs < 50 || retryBaseDelayMs > 30000) {
      return "retryBaseDelayMs must be an integer between 50 and 30000";
    }
  }

  if (body.usernameLength !== undefined) {
    const usernameLength = Number(body.usernameLength);
    if (!Number.isInteger(usernameLength) || usernameLength < 3 || usernameLength > 32) {
      return "usernameLength must be an integer between 3 and 32";
    }
  }

  if (body.passwordLength !== undefined) {
    const passwordLength = Number(body.passwordLength);
    if (!Number.isInteger(passwordLength) || passwordLength < 8 || passwordLength > 64) {
      return "passwordLength must be an integer between 8 and 64";
    }
  }

  if (body.delayMinMs !== undefined) {
    const delayMinMs = Number(body.delayMinMs);
    if (!Number.isInteger(delayMinMs) || delayMinMs < 0 || delayMinMs > 60000) {
      return "delayMinMs must be an integer between 0 and 60000";
    }
  }

  if (body.delayMaxMs !== undefined) {
    const delayMaxMs = Number(body.delayMaxMs);
    if (!Number.isInteger(delayMaxMs) || delayMaxMs < 0 || delayMaxMs > 60000) {
      return "delayMaxMs must be an integer between 0 and 60000";
    }
  }

  if (
    body.delayMinMs !== undefined &&
    body.delayMaxMs !== undefined &&
    Number(body.delayMinMs) > Number(body.delayMaxMs)
  ) {
    return "delayMinMs cannot be greater than delayMaxMs";
  }

  if (body.mode !== undefined) {
    const mode = String(body.mode).toLowerCase();
    if (!["api", "browser"].includes(mode)) {
      return "mode must be either 'api' or 'browser'";
    }
  }

  return null;
}

async function createProvisioningJob(req, res, next) {
  try {
    const validationError = validateRequest(req.body || {});
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const {
      count = 1,
      mode = "api",
      pleskHost,
      pleskUsername,
      pleskPassword,
      usernameLength = 12,
      passwordLength = 12,
      usernamePrefix = "",
      delayMinMs,
      delayMaxMs,
      maxRetries,
      retryBaseDelayMs,
      includePassword = false
    } = req.body || {};

    const result = await provisionAccounts({
      count,
      mode,
      pleskHost,
      pleskUsername,
      pleskPassword,
      usernameLength,
      passwordLength,
      usernamePrefix,
      delayMinMs,
      delayMaxMs,
      maxRetries,
      retryBaseDelayMs,
      includePassword
    });
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

async function startProvisioningJob(req, res, next) {
  try {
    const validationError = validateRequest(req.body || {});
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const payload = req.body || {};
    const job = createJob({ input: payload });
    appendLog(job.requestId, "Job accepted by server.");

    (async () => {
      try {
        const result = await provisionAccounts({
          ...payload,
          onLog: (line) => appendLog(job.requestId, line)
        });
        finishJob(job.requestId, result);
      } catch (error) {
        appendLog(job.requestId, `Job failed: ${error.message}`);
        failJob(job.requestId, error.message);
      }
    })();

    return res.status(202).json({
      requestId: job.requestId,
      status: "running"
    });
  } catch (error) {
    return next(error);
  }
}

function getProvisioningJobStatus(req, res) {
  const snapshot = getJobSnapshot(req.params.requestId);
  if (!snapshot) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.set("Cache-Control", "no-store");
  return res.json(snapshot);
}

module.exports = {
  createProvisioningJob,
  startProvisioningJob,
  getProvisioningJobStatus
};
