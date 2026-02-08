export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason?: string };

export interface GuardClientOptions {
  /** Guard API base URL, e.g. https://guard-api...up.railway.app */
  baseUrl: string;

  /** MASTER_KEY (server-only). Sent as x-guard-key */
  masterKey: string;

  /** Customer API key. Sent as x-api-key */
  apiKey: string;

  /** Request timeout in ms (default 800ms) */
  timeoutMs?: number;
}

export class GuardClient {
  private baseUrl: string;
  private masterKey: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(opts: GuardClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.masterKey = opts.masterKey;
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 800;
  }

  /**
   * Ask Guard whether this request should be allowed.
   * `route` should match the logical endpoint in client's app (e.g. "/api/login").
   */

  async check(route: string): Promise<GuardDecision> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guard-key": this.masterKey,
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({ route }),
        signal: controller.signal,
      });

      // Guard returns JSON like { allowed: true } or { allowed:false, reason? }
      const data = (await res.json()) as GuardDecision;
      return data;
    } catch {
      // Fail closed by default (safer). Client app can choose how to handle it.
      return { allowed: false, reason: "SERVICE_UNAVAILABLE" };
    } finally {
      clearTimeout(t);
    }
  }
}
