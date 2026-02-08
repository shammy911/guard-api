# Guard API (v1)
A lightweight **rate limiting + abuse protection** API you can put in front of any service.
Built for developers who want a simple “allow / block” decision endpoint with real usage visibility.

## What it does
- IP + route based rate limiting
- API key plans (Free / Pro)
- Daily usage tracking (allowed vs blocked)
- Monthly usage aggregation (for quotas / billing)
- Minimal dashboard for quick visibility

---

## Quick links
- Health: `GET /health`
- Check decision: `POST /check`
- Usage: `GET /usage`
- Dashboard: `GET /dashboard`

---

## Authentication model
Guard uses **two keys**:

### 1) Guard Master Key (internal)
Header:
- `x-guard-key: <MASTER_KEY>`

This protects your Guard API from being called by random clients.
Only your backend/services should know it.

### 2) Customer API Key (per-customer/app)
Header:
- `x-api-key: <API_KEY>`

This identifies the customer/app plan and usage.

---

## Request flow
Your app calls Guard before processing a sensitive request:

1) App → Guard `/check`
2) Guard returns `{ allowed: true }` or `{ allowed: false }`
3) Your app decides to proceed or block/slowdown.

Guard does not block traffic for you — it provides the decision.

---

## Endpoints

### `GET /health`
Public health check.

Response:
```json
{ "status": "ok", "uptime": 123.45 }
