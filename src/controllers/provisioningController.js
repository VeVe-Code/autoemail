const { provisionAccounts } = require("../services/accountProvisioningService");

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
      maxRetries,
      retryBaseDelayMs,
      includePassword = false
    } = req.body || {};

    const result = await provisionAccounts({
      count,
      maxRetries,
      retryBaseDelayMs,
      includePassword
    });
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createProvisioningJob
};
