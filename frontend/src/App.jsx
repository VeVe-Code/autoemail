import { useState } from "react";

const REMEMBER_KEY = "pleskUsernameRemembered";
const STORED_USERNAME_KEY = "pleskUsername";

function App() {
  const isVercel =
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith(".vercel.app") ||
      window.location.hostname.includes("vercel"));
  const remembered = localStorage.getItem(REMEMBER_KEY) === "true";
  const [form, setForm] = useState({
    mode: isVercel ? "api" : "browser",
    pleskHost: "",
    pleskUsername: remembered ? localStorage.getItem(STORED_USERNAME_KEY) || "" : "",
    pleskPassword: "",
    rememberUsername: remembered,
    count: 1,
    usernameLength: 6,
    passwordLength: 12,
    usernamePrefix: "",
    maxRetries: 3,
    retryBaseDelayMs: 500,
    delayMinMs: 1000,
    delayMaxMs: 2000,
    includePassword: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [requestId, setRequestId] = useState("");
  const [logs, setLogs] = useState([]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function readJsonOrThrow(response, fallbackMessage) {
    const raw = await response.text();
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (_error) {
        if (!response.ok) {
          throw new Error(
            `${fallbackMessage} (HTTP ${response.status}): ${raw.slice(0, 180)}`
          );
        }
        throw new Error(`${fallbackMessage}: non-JSON response`);
      }
    }

    if (!response.ok) {
      throw new Error(
        parsed?.error || `${fallbackMessage} (HTTP ${response.status})`
      );
    }

    return parsed || {};
  }

  async function pollStatus(id) {
    while (true) {
      const response = await fetch(`/api/provision/${id}/status?t=${Date.now()}`, {
        cache: "no-store"
      });
      const data = await readJsonOrThrow(response, "Unable to load job status");

      setLogs(data.logs || []);
      if (data.result) {
        setResult(data.result);
      }
      if (data.status === "completed") {
        return;
      }
      if (data.status === "failed") {
        throw new Error(data.error || "Provisioning job failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async function submitProvisioning(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setLogs([]);
    setRequestId("");

    try {
      if (form.rememberUsername) {
        localStorage.setItem(REMEMBER_KEY, "true");
        localStorage.setItem(STORED_USERNAME_KEY, form.pleskUsername);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(STORED_USERNAME_KEY);
      }

      const response = await fetch("/api/provision/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: form.mode,
          pleskHost: form.pleskHost || undefined,
          pleskUsername: form.pleskUsername || undefined,
          pleskPassword: form.pleskPassword || undefined,
          count: Number(form.count),
          usernameLength: Number(form.usernameLength),
          passwordLength: Number(form.passwordLength),
          usernamePrefix: form.usernamePrefix,
          maxRetries: Number(form.maxRetries),
          retryBaseDelayMs: Number(form.retryBaseDelayMs),
          delayMinMs: Number(form.delayMinMs),
          delayMaxMs: Number(form.delayMaxMs),
          includePassword: form.includePassword
        })
      });

      const data = await readJsonOrThrow(response, "Provisioning start failed");
      setRequestId(data.requestId || "");
      if (data.result || data.status === "completed") {
        setLogs(data.logs || []);
        setResult(data.result || null);
      } else {
        await pollStatus(data.requestId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-4xl px-4">
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold text-slate-900">
            Mailbox Provisioning (Plesk)
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Server-side Plesk integration for authorized mailbox creation only.
          </p>
        </div>

        <form
          onSubmit={submitProvisioning}
          className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Mode</span>
              <select
                value={form.mode}
                onChange={(event) => updateField("mode", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="browser">browser automation</option>
                <option value="api">plesk api</option>
              </select>
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Plesk host (optional)</span>
              <input
                type="text"
                value={form.pleskHost}
                onChange={(event) => updateField("pleskHost", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="https://host:8443"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Plesk username</span>
              <input
                type="text"
                value={form.pleskUsername}
                onChange={(event) => updateField("pleskUsername", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Plesk password</span>
              <input
                type="password"
                value={form.pleskPassword}
                onChange={(event) => updateField("pleskPassword", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.rememberUsername}
                onChange={(event) =>
                  updateField("rememberUsername", event.target.checked)
                }
              />
              Remember username (password is never stored)
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Count</span>
              <input
                type="number"
                min={1}
                max={20}
                value={form.count}
                onChange={(event) => updateField("count", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Username length</span>
              <input
                type="number"
                min={3}
                max={32}
                value={form.usernameLength}
                onChange={(event) =>
                  updateField("usernameLength", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Password length</span>
              <input
                type="number"
                min={8}
                max={64}
                value={form.passwordLength}
                onChange={(event) =>
                  updateField("passwordLength", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Username prefix (optional)</span>
              <input
                type="text"
                value={form.usernamePrefix}
                onChange={(event) =>
                  updateField("usernamePrefix", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="team"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Max retries</span>
              <input
                type="number"
                min={0}
                max={10}
                value={form.maxRetries}
                onChange={(event) => updateField("maxRetries", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Retry base delay (ms)</span>
              <input
                type="number"
                min={50}
                max={30000}
                value={form.retryBaseDelayMs}
                onChange={(event) =>
                  updateField("retryBaseDelayMs", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Delay min (ms)</span>
              <input
                type="number"
                min={0}
                max={60000}
                value={form.delayMinMs}
                onChange={(event) => updateField("delayMinMs", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Delay max (ms)</span>
              <input
                type="number"
                min={0}
                max={60000}
                value={form.delayMaxMs}
                onChange={(event) => updateField("delayMaxMs", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Include password in response</span>
              <select
                value={String(form.includePassword)}
                onChange={(event) =>
                  updateField("includePassword", event.target.value === "true")
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="false">false (recommended)</option>
                <option value="true">true</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Provisioning..."
                : isVercel
                  ? "Start Provisioning"
                  : "Start Provisioning (Async)"}
            </button>
            <span className="text-xs text-slate-500">
              API:
              <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">
                POST /api/provision/start
              </code>
            </span>
          </div>
        </form>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Live Log Tail</h2>
          {requestId ? (
            <p className="mt-1 text-xs text-slate-500">
              Request ID: <code>{requestId}</code>
            </p>
          ) : null}
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            {(logs.length ? logs : ["No logs yet..."]).join("\n")}
          </pre>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Result</h2>
            <p className="mt-1 text-sm text-slate-600">
              Request ID: <code>{result.requestId}</code>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Processed: {result.totalProcessed}/{result.totalRequested}
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="px-2 py-2">Email</th>
                    <th className="px-2 py-2">Username</th>
                    <th className="px-2 py-2">Password</th>
                    <th className="px-2 py-2">Retries</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.results || []).map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-slate-700">{item.email}</td>
                      <td className="px-2 py-2 text-slate-700">
                        {item.username}
                      </td>
                      <td className="px-2 py-2 text-slate-500">
                        {item.password || "-"}
                      </td>
                      <td className="px-2 py-2 text-slate-500">
                        {item.retries ?? "-"}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            item.status === "created"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-500">
                        {item.error || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default App;
