const childProcess = require("child_process");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
}
const { chromium } = require("playwright");
const env = require("../config/env");

let playwrightBrowserReady = false;

function ensurePlaywrightChromiumInstalled() {
  if (playwrightBrowserReady) {
    return;
  }
  const installEnv = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "0"
  };
  childProcess.execSync("npx playwright install chromium", {
    stdio: "inherit",
    env: installEnv
  });
  playwrightBrowserReady = true;
}

function debugLog(hypothesisId, location, message, data = {}) {
  // disabled fetch to prevent hangs
  console.log(`[DEBUG] ${location}: ${message}`, JSON.stringify(data));
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.click();
      return true;
    }
  }
  return false;
}

async function clickCreateEmailAction(page) {
  const textPatterns = [
    /create email address/i,
    /create email/i,
    /add email address/i,
    /add email/i
  ];

  for (const pattern of textPatterns) {
    const candidates = [
      page.getByRole("button", { name: pattern }).first(),
      page.getByRole("link", { name: pattern }).first(),
      page.locator("[role='button']").filter({ hasText: pattern }).first(),
      page.locator("a").filter({ hasText: pattern }).first(),
      page.locator("button").filter({ hasText: pattern }).first(),
      page.locator(`text=${pattern.source.replace(/[\\^$.*+?()[\]{}|]/g, "")}`).first()
    ];

    for (const locator of candidates) {
      try {
        if ((await locator.count()) > 0) {
          await locator.click({ timeout: 1200 });
          return true;
        }
      } catch (_error) {
        // try next locator variant
      }
    }
  }

  return false;
}

async function fillFirst(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.fill(value);
      return true;
    }
  }
  return false;
}

async function clearAndType(locator, value, delayMs = 50) {
  await locator.click();
  await locator.fill("");
  await locator.type(value, { delay: delayMs });
}

async function waitForAnySelector(page, selectors, timeoutMs) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: timeoutMs });
      return selector;
    } catch (_error) {
      // try next selector
    }
  }
  return null;
}

async function dismissCookieBanner(page) {
  await clickFirst(page, [
    "button:has-text('Accept all cookies')",
    "button:has-text('Accept necessary cookies')",
    "button:has-text('Accept')",
    "[data-qa='cookie-accept-all']",
    "[data-qa='cookie-accept-necessary']"
  ]);
}

async function isLikelyLoggedIn(page) {
  const url = page.url();
  if (url.includes("/smb/") || url.includes("/web/view")) {
    return true;
  }

  const markers = [
    "a:has-text('Websites & Domains')",
    "a:has-text('Mail')",
    "a:has-text('Files')",
    "a:has-text('Databases')",
    "a:has-text('Account')"
  ];

  for (const selector of markers) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      return true;
    }
  }

  return false;
}

async function waitForLoginCompletion(page, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isLikelyLoggedIn(page)) {
      return true;
    }

    const stillOnLoginForm = await waitForAnySelector(
      page,
      ["#passwd", "input[name='passwd']", "input[type='password']"],
      250
    );
    if (stillOnLoginForm && (page.url().includes("/login") || page.url().includes("login_up.php"))) {
      await page.waitForTimeout(300);
      continue;
    }

    await page.waitForTimeout(300);
  }

  return false;
}

async function hasCreateFormFields(page, timeoutMs = 1500) {
  const hasMailname = await waitForAnySelector(
    page,
    [
      "input[name='mailname']",
      "input[name='name']",
      "input[data-qa='mailname']",
      "input[id*='mail']",
      "input[placeholder*='mail' i]",
      "input[placeholder*='email' i]",
      "input[type='text']"
    ],
    timeoutMs
  );
  const hasPassword = await waitForAnySelector(
    page,
    [
      "input[name='passwd']",
      "input[name='password']",
      "input[data-qa='password']",
      "input[name='confirm']",
      "input[name='confirmPassword']",
      "input[id*='pass' i]",
      "input[type='password']"
    ],
    timeoutMs
  );
  return Boolean(hasMailname && hasPassword);
}

async function fillCreateMailboxForm(page, { mailname, mailboxPassword }) {
  const typeDelayMs = env.pleskBrowserTypeDelayMs > 0 ? env.pleskBrowserTypeDelayMs : 50;
  let filledMailName = false;

  const labeledEmailInput = page.getByLabel(/email address/i).first();
  if ((await labeledEmailInput.count()) > 0) {
    await clearAndType(labeledEmailInput, mailname, typeDelayMs);
    filledMailName = true;
  } else {
    const emailCandidates = [
      "input[name='mailname']",
      "input[name='name']",
      "input[placeholder*='Email']",
      "input[placeholder*='mail' i]",
      "input[data-qa='mailname']",
      "input[id*='mail']"
    ];
    for (const selector of emailCandidates) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        await clearAndType(locator, mailname, typeDelayMs);
        filledMailName = true;
        break;
      }
    }
  }

  if (!filledMailName) {
    filledMailName = await page.evaluate((value) => {
      const candidates = Array.from(document.querySelectorAll("input, textarea")).filter((el) => {
        const input = el;
        const type = (input.getAttribute("type") || "text").toLowerCase();
        const hiddenLike = ["hidden", "password", "checkbox", "radio", "file", "submit", "button"];
        if (hiddenLike.includes(type)) return false;
        if (input.disabled || input.readOnly) return false;
        if (input.offsetParent === null) return false;
        const key = `${input.name || ""} ${input.id || ""} ${input.placeholder || ""}`.toLowerCase();
        if (key.includes("search") || key.includes("filter")) return false;
        return true;
      });

      if (!candidates.length) return false;
      candidates[0].focus();
      candidates[0].value = "";
      candidates[0].dispatchEvent(new Event("input", { bubbles: true }));
      candidates[0].value = value;
      candidates[0].dispatchEvent(new Event("input", { bubbles: true }));
      candidates[0].dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, mailname);
  }

  const passwordFields = page.locator("input[type='password'], input[name*='pass' i], input[id*='pass' i]");
  const passwordCount = await passwordFields.count();
  let filledPassword = false;

  const labeledPasswordInput = page.getByLabel(/^password/i).first();
  const labeledConfirmInput = page.getByLabel(/confirm password/i).first();

  if ((await labeledPasswordInput.count()) > 0) {
    await clearAndType(labeledPasswordInput, mailboxPassword, typeDelayMs);
    filledPassword = true;
    if ((await labeledConfirmInput.count()) > 0) {
      await clearAndType(labeledConfirmInput, mailboxPassword, typeDelayMs);
    }
  } else if (passwordCount > 0) {
    await clearAndType(passwordFields.nth(0), mailboxPassword, typeDelayMs);
    filledPassword = true;
    if (passwordCount > 1) {
      await clearAndType(passwordFields.nth(1), mailboxPassword, typeDelayMs);
    } else {
      await fillFirst(page, ["input[name='confirm']", "input[name='confirmPassword']"], mailboxPassword);
    }
  }

  return { filledMailName, filledPassword };
}

async function listActionTexts(page) {
  return page.evaluate(() => {
    const texts = [];
    const nodes = document.querySelectorAll("button, a, [role='button']");
    for (const node of nodes) {
      const text = (node.textContent || "").trim().replace(/\s+/g, " ");
      if (text) {
        texts.push(text);
      }
    }
    return Array.from(new Set(texts)).slice(0, 25);
  });
}

async function listCandidateHrefs(page, host) {
  const hrefs = await page.evaluate(() => {
    const out = [];
    const nodes = document.querySelectorAll("a[href]");
    for (const node of nodes) {
      const href = (node.getAttribute("href") || "").trim();
      if (href) out.push(href);
    }
    return Array.from(new Set(out));
  });

  return hrefs
    .map((href) => {
      try {
        return new URL(href, host).toString();
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean)
    .filter(
      (url) =>
        url.includes("email-address") ||
        url.includes("/mail") ||
        url.includes("mailname") ||
        url.includes("create")
    )
    .slice(0, 20);
}

async function closeBrowserSession(session) {
  if (!session) {
    return;
  }
  try {
    if (session.context) {
      await session.context.close();
    }
  } finally {
    try {
      if (session.browser) {
        await session.browser.close();
      }
    } finally {
      session.browser = null;
      session.context = null;
      session.page = null;
      session.initialized = false;
    }
  }
}

async function createMailboxViaBrowser(
  { host, username, password, domain, mailname, mailboxPassword },
  { timeoutMs = 30000, session = null } = {}
) {
  const usingSharedSession = Boolean(session);
  let browser = usingSharedSession ? session.browser : null;
  let context = usingSharedSession ? session.context : null;
  let page = usingSharedSession ? session.page : null;

  if (!page) {
    ensurePlaywrightChromiumInstalled();
    browser = await chromium.launch({
      headless: env.pleskBrowserHeadless,
      slowMo: env.pleskBrowserSlowMoMs > 0 ? env.pleskBrowserSlowMoMs : undefined
    });
    context = await browser.newContext({ ignoreHTTPSErrors: true });
    page = await context.newPage();

    if (usingSharedSession) {
      session.browser = browser;
      session.context = context;
      session.page = page;
      session.initialized = false;
    }
  }

  page.setDefaultTimeout(timeoutMs);

  try {
    debugLog("H1", "pleskBrowserService.js:createMailboxViaBrowser:entry", "Browser flow started", {
      host,
      domain
    });
    if (!usingSharedSession || !session.initialized) {
      await page.goto(host, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await dismissCookieBanner(page);
    } else {
      debugLog(
        "H1",
        "pleskBrowserService.js:createMailboxViaBrowser:session-reuse",
        "Reusing existing authenticated browser session",
        { url: page.url() }
      );
    }

    // If not already authenticated, complete login.
    const hasPasswordInput = usingSharedSession && session.initialized
      ? null
      : await waitForAnySelector(
        page,
        ["#passwd", "input[name='passwd']", "input[type='password']"],
        4000
      );

    if (hasPasswordInput) {
      const userFilled = await fillFirst(
        page,
        [
          "#login_name",
          "input[name='login_name']",
          "input[name='login']",
          "input[name='username']",
          "input[type='text']"
        ],
        username
      );
      const passFilled = await fillFirst(
        page,
        ["#passwd", "input[name='passwd']", "input[type='password']"],
        password
      );
      debugLog(
        "H6",
        "pleskBrowserService.js:createMailboxViaBrowser:login-fill",
        "Login fields fill attempt",
        { userFilled, passFilled }
      );
      if (!userFilled || !passFilled) {
        throw new Error("Could not locate Plesk login form fields");
      }

      const clickedLogin = await clickFirst(page, [
        "button[type='submit']",
        "input[type='submit']",
        "button:has-text('Log in')",
        "button:has-text('Sign in')"
      ]);
      if (!clickedLogin) {
        throw new Error("Could not submit Plesk login form");
      }

      await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
      await page.waitForTimeout(600);
      await dismissCookieBanner(page);
      const loginCompleted = await waitForLoginCompletion(page, 8000);
      debugLog(
        "H7",
        "pleskBrowserService.js:createMailboxViaBrowser:after-login",
        "After login submit",
        { url: page.url(), loginCompleted }
      );
      if (!loginCompleted) {
        throw new Error(
          "Plesk login did not complete. Check Plesk username/password and whether captcha/2FA is enabled."
        );
      }

      if (usingSharedSession) {
        session.initialized = true;
      }
    } else if (usingSharedSession && !session.initialized) {
      session.initialized = true;
    }

    await clickFirst(page, [
      "a:has-text('Mail')",
      "button:has-text('Mail')",
      "[href*='smb/email-address/list']"
    ]);

    await page.goto(`${host}/smb/email-address/list/id/${encodeURIComponent(domain)}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });
    await page.waitForTimeout(1000);
    await dismissCookieBanner(page);
    debugLog(
      "H1",
      "pleskBrowserService.js:createMailboxViaBrowser:mail-page",
      "Mail page reached",
      {
        url: page.url()
      }
    );

    let hasCreateForm = false;
    const preferredCreateUrl = `${host}/smb/email-address/create/domain/${encodeURIComponent(domain)}`;
    try {
      await page.goto(preferredCreateUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForTimeout(500);
      await dismissCookieBanner(page);
      hasCreateForm = await hasCreateFormFields(page, 1200);
      debugLog(
        "H1",
        "pleskBrowserService.js:createMailboxViaBrowser:preferred-create-url",
        "Preferred direct create page attempt",
        { attemptedUrl: preferredCreateUrl, hasCreateForm, currentUrl: page.url() }
      );
    } catch (_preferredCreateError) {
      // fallback below
    }

    if (!hasCreateForm) {
      await page.goto(`${host}/smb/email-address/list/id/${encodeURIComponent(domain)}`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs
      });
      await page.waitForTimeout(500);
      await dismissCookieBanner(page);
      hasCreateForm = await hasCreateFormFields(page, 900);
    }

    debugLog(
      "H2",
      "pleskBrowserService.js:createMailboxViaBrowser:initial-form-check",
      "Initial create form field detection",
      { hasCreateForm }
    );
    if (!hasCreateForm) {
      const clickedCreate = await clickCreateEmailAction(page);

      if (clickedCreate) {
        await page.waitForTimeout(500);
        await dismissCookieBanner(page);
      }

      hasCreateForm = await hasCreateFormFields(page, 900);
      debugLog(
        "H2",
        "pleskBrowserService.js:createMailboxViaBrowser:after-create-click",
        "After create button click",
        { clickedCreate, hasCreateForm, url: page.url() }
      );
    }

    if (!hasCreateForm) {
      const directCreateUrls = [
        `${host}/smb/email-address/create/domain/${encodeURIComponent(domain)}`,
        `${host}/smb/email-address/create`
      ];

      for (const url of directCreateUrls) {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
          await page.waitForTimeout(350);
          await dismissCookieBanner(page);
          hasCreateForm = await hasCreateFormFields(page, 700);
          debugLog(
            "H3",
            "pleskBrowserService.js:createMailboxViaBrowser:direct-url-attempt",
            "Direct create URL attempt",
            { attemptedUrl: url, hasCreateForm, currentUrl: page.url() }
          );
          if (hasCreateForm) {
            break;
          }
        } catch (_urlError) {
          // try next URL
        }
      }
    }

    if (!hasCreateForm) {
      const candidateHrefs = await listCandidateHrefs(page, host);
      debugLog(
        "H5",
        "pleskBrowserService.js:createMailboxViaBrowser:candidate-hrefs",
        "Trying candidate hrefs discovered in current page",
        { count: candidateHrefs.length, candidateHrefs }
      );

      for (const href of candidateHrefs.slice(0, 2)) {
        try {
          await page.goto(href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
          await page.waitForTimeout(350);
          await dismissCookieBanner(page);
          const clickedCreate = await clickCreateEmailAction(page);
          if (clickedCreate) {
            await page.waitForTimeout(350);
          }
          hasCreateForm = await hasCreateFormFields(page, 700);
          debugLog(
            "H5",
            "pleskBrowserService.js:createMailboxViaBrowser:candidate-href-attempt",
            "Candidate href attempt result",
            { attemptedHref: href, clickedCreate, hasCreateForm, currentUrl: page.url() }
          );
          if (hasCreateForm) {
            break;
          }
        } catch (_hrefError) {
          // try next href
        }
      }
    }

    if (!hasCreateForm) {
      const actions = await listActionTexts(page);
      debugLog(
        "H4",
        "pleskBrowserService.js:createMailboxViaBrowser:final-fail",
        "Create form unavailable after all attempts",
        { visibleActions: actions, finalUrl: page.url() }
      );
      throw new Error(
        `Could not open the create email form in Plesk UI. Visible actions: ${actions.join(" | ")}`
      );
    }

    await page.waitForTimeout(1000);

    const { filledMailName, filledPassword } = await fillCreateMailboxForm(page, {
      mailname,
      mailboxPassword
    });
    debugLog(
      "H8",
      "pleskBrowserService.js:createMailboxViaBrowser:form-fill",
      "Create form fill result",
      { filledMailName, filledPassword }
    );

    if (!filledMailName || !filledPassword) {
      throw new Error("Could not fill create mailbox form fields");
    }

    if (env.pleskBrowserVisualPauseMs > 0) {
      await page.waitForTimeout(env.pleskBrowserVisualPauseMs);
    }

    const clickedOk = await clickFirst(page, [
      "button:has-text('OK')",
      "[role='button']:has-text('OK')",
      "button:has-text('Create')",
      "button:has-text('Apply')",
      "input[type='submit']"
    ]);
    if (!clickedOk) {
      throw new Error("Could not submit create mailbox form");
    }

    await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
    await page.waitForTimeout(1000);

    return { ok: true };
  } catch (error) {
    try {
      await page.screenshot({ path: "playwright-last-error.png", fullPage: true });
    } catch (_screenshotError) {
      // ignore screenshot errors
    }
    throw error;
  } finally {
    if (!usingSharedSession) {
      await context.close();
      await browser.close();
    }
  }
}

module.exports = {
  createMailboxViaBrowser,
  closeBrowserSession
};
