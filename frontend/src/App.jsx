import { useState } from "react";

function App() {
  const [form, setForm] = useState({
    count: 1,
    maxRetries: 3,
    retryBaseDelayMs: 500,
    includePassword: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submitProvisioning(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: Number(form.count),
          maxRetries: Number(form.maxRetries),
          retryBaseDelayMs: Number(form.retryBaseDelayMs),
          includePassword: form.includePassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Provisioning failed");
      }

      setResult(data);
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              {loading ? "Provisioning..." : "Start Provisioning"}
            </button>
            <span className="text-xs text-slate-500">
              API:
              <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">
                POST /api/provision
              </code>
            </span>
          </div>
        </form>

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
