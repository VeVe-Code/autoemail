const { v4: uuidv4 } = require("uuid");

const jobs = new Map();

function nowIso() {
  return new Date().toISOString();
}

function createJob({ input }) {
  const requestId = uuidv4();
  const job = {
    requestId,
    status: "running",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    input,
    logs: [`[${nowIso()}] Starting provisioning job...`],
    result: null,
    error: null
  };
  jobs.set(requestId, job);
  return job;
}

function appendLog(requestId, line) {
  const job = jobs.get(requestId);
  if (!job) return;
  job.logs.push(`[${nowIso()}] ${line}`);
  if (job.logs.length > 1000) {
    job.logs.splice(0, job.logs.length - 1000);
  }
  job.updatedAt = nowIso();
}

function finishJob(requestId, result) {
  const job = jobs.get(requestId);
  if (!job) return;
  job.status = "completed";
  job.result = result;
  job.updatedAt = nowIso();
}

function failJob(requestId, errorMessage) {
  const job = jobs.get(requestId);
  if (!job) return;
  job.status = "failed";
  job.error = errorMessage;
  job.updatedAt = nowIso();
}

function getJob(requestId) {
  return jobs.get(requestId);
}

function getJobSnapshot(requestId) {
  const job = jobs.get(requestId);
  if (!job) return null;
  return {
    requestId: job.requestId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    logs: job.logs,
    result: job.result,
    error: job.error
  };
}

module.exports = {
  createJob,
  appendLog,
  finishJob,
  failJob,
  getJob,
  getJobSnapshot
};
