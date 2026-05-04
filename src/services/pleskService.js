const axios = require("axios");
const https = require("https");
const env = require("../config/env");
const logger = require("../utils/logger");
const { withRetry } = require("../utils/retry");

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const siteIdCache = new Map();

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildAuthHeaders() {
  const method = env.pleskAuthMethod;

  if (method === "key" || method === "secret" || method === "apikey") {
    if (!env.pleskKey) {
      throw new Error("PLESK_KEY is required when PLESK_AUTH_METHOD=key");
    }

    return {
      KEY: env.pleskKey
    };
  }

  if (!env.pleskUsername || !env.pleskPassword) {
    throw new Error("PLESK_USERNAME and PLESK_PASSWORD are required for plain auth");
  }

  // Per Plesk XML-RPC docs, credentials are passed as HTTP headers (not in XML <auth>).
  return {
    HTTP_AUTH_LOGIN: env.pleskUsername,
    HTTP_AUTH_PASSWD: env.pleskPassword
  };
}

function wrapPacket(innerOperatorXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<packet version="${escapeXml(env.pleskPacketVersion)}">
${innerOperatorXml}
</packet>`;
}

function parsePleskError(body) {
  const errcodeMatch = String(body).match(/<errcode>([^<]+)<\/errcode>/);
  const errtextMatch = String(body).match(/<errtext>([^<]+)<\/errtext>/);
  return {
    errcode: errcodeMatch ? errcodeMatch[1] : "unknown",
    errtext: errtextMatch ? errtextMatch[1] : "unknown"
  };
}

function isTransientPleskError(errcode) {
  return ["1015", "1013"].includes(String(errcode));
}

function isTransientHttpStatus(status) {
  return [429, 500, 502, 503, 504].includes(Number(status));
}

async function postPleskXml(xml, { label = "plesk.call" } = {}) {
  logger.info("plesk.request", { label });

  try {
    const response = await axios.post(
      `${env.pleskHost}/enterprise/control/agent.php`,
      xml,
      {
        headers: {
          "Content-Type": "text/xml; charset=UTF-8",
          ...buildAuthHeaders()
        },
        httpsAgent,
        timeout: 30000,
        transformResponse: [(data) => data],
        validateStatus: () => true
      }
    );

    if (isTransientHttpStatus(response.status)) {
      const error = new Error(`HTTP ${response.status} from Plesk`);
      error.isTransient = true;
      throw error;
    }

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(`HTTP ${response.status} from Plesk`);
      error.isTransient = false;
      throw error;
    }

    const body = response.data;
    if (String(body).includes("<status>error</status>")) {
      const { errcode, errtext } = parsePleskError(body);
      const error = new Error(`Plesk error ${errcode}: ${errtext}`);
      error.pleskXml = body;
      error.pleskErrcode = errcode;
      error.isTransient = isTransientPleskError(errcode);
      throw error;
    }

    return body;
  } catch (error) {
    if (typeof axios.isAxiosError === "function" && axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status && isTransientHttpStatus(status)) {
        const wrapped = new Error(error.message);
        wrapped.isTransient = true;
        throw wrapped;
      }

      if (!error.response) {
        const wrapped = new Error(error.message);
        wrapped.isTransient = true;
        throw wrapped;
      }
    }

    throw error;
  }
}

async function callPleskApi(innerOperatorXml, { label = "plesk.call", retries, baseDelayMs } = {}) {
  const xml = wrapPacket(innerOperatorXml);

  return withRetry(
    async ({ attempt }) => postPleskXml(xml, { label: `${label}#${attempt}` }),
    {
      retries,
      baseDelayMs,
      label
    }
  );
}

function extractSiteIdFromSiteGet(xml) {
  const match = String(xml).match(/<id>(\d+)<\/id>/);
  return match ? Number(match[1]) : undefined;
}

async function getSiteIdForDomain(domain, { retries, baseDelayMs } = {}) {
  if (!domain) {
    throw new Error("DOMAIN is required");
  }

  if (env.pleskSiteId) {
    return env.pleskSiteId;
  }

  const cached = siteIdCache.get(domain);
  if (cached) {
    return cached;
  }

  const innerOperatorXml = `
  <site>
    <get>
      <filter>
        <name>${escapeXml(domain)}</name>
      </filter>
      <dataset>
        <gen_info/>
      </dataset>
    </get>
  </site>`;

  const responseXml = await callPleskApi(innerOperatorXml, {
    label: "plesk.site.get",
    retries,
    baseDelayMs
  });

  const siteId = extractSiteIdFromSiteGet(responseXml);
  if (!siteId) {
    throw new Error(`Unable to resolve site-id for domain: ${domain}`);
  }

  siteIdCache.set(domain, siteId);
  return siteId;
}

async function createMailbox(
  { domain, username, password },
  { retries = env.pleskMaxRetries, baseDelayMs = env.pleskRetryBaseDelayMs } = {}
) {
  if (!domain) {
    throw new Error("DOMAIN is required");
  }

  const siteId = await getSiteIdForDomain(domain, { retries, baseDelayMs });

  const innerOperatorXml = `
  <mail>
    <create>
      <filter>
        <site-id>${escapeXml(siteId)}</site-id>
        <mailname>
          <name>${escapeXml(username)}</name>
          <mailbox>
            <enabled>true</enabled>
          </mailbox>
          <password>
            <value>${escapeXml(password)}</value>
            <type>plain</type>
          </password>
        </mailname>
      </filter>
    </create>
  </mail>`;

  return callPleskApi(innerOperatorXml, {
    label: "plesk.mail.create",
    retries,
    baseDelayMs
  });
}

module.exports = {
  createMailbox,
  callPleskApi
};
