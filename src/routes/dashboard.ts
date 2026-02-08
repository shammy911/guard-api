import type { FastifyInstance } from "fastify";

export default async function dashboard(app: FastifyInstance) {
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(`
<!DOCTYPE html>
<html>
<head>
  <title>Guard Dashboard</title>
  <style>
    body { font-family: system-ui; padding: 32px; background: #0f172a; color: #e5e7eb; }
    .card { background: #020617; padding: 20px; border-radius: 8px; max-width: 600px; }
    h1 { margin-bottom: 8px; }
    .muted { color: #94a3b8; }
    .row { display: flex; justify-content: space-between; margin: 6px 0; }
    .ok { color: #22c55e; }
    .warn { color: #facc15; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Guard API</h1>
    <div class="muted">Minimal dashboard</div>
    <hr />
    <div id="content">Loading…</div>
  </div>

  <script>
    fetch('/dashboard/data', {
      headers: {
        'x-api-key': localStorage.getItem('apiKey')
      }
    })
    .then(r => r.json())
    .then(d => {
      document.getElementById('content').innerHTML = \`
        <div class="row"><b>API Key</b><span>\${d.apiKey}</span></div>
        <div class="row"><b>Plan</b><span class="ok">\${d.plan}</span></div>
        <hr />
        <div class="row"><b>RPM Limit</b><span>\${d.limits.rpm}</span></div>
        <div class="row"><b>Monthly Limit</b><span>\${d.limits.monthly}</span></div>
        <hr />
        <div class="row"><b>Today Allowed</b><span>\${d.usage.today.allowed}</span></div>
        <div class="row"><b>Today Blocked</b><span class="warn">\${d.usage.today.blocked}</span></div>
        <hr />
        <div class="row"><b>This Month</b><span>\${d.usage.month}</span></div>
      \`;
    })
    .catch(() => {
      document.getElementById('content').innerHTML = 'Invalid API key';
    });
  </script>
</body>
</html>
    `);
  });
}
