export type GuardReason =
  | "RATE_LIMIT"
  | "MONTHLY_QUOTA_EXCEEDED"
  | "GUARD_RATE_LIMIT"
  | "SERVICE_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "INVALID_API_KEY"
  | "API_KEY_DISABLED"
  | "ROUTE_REQUIRED";

export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason?: GuardReason };

export interface GuardClientOptions {
  /** Guard API base URL, e.g. https://guard-api...up.railway.app */
  baseUrl: string;

  /** Customer API key. Sent as x-api-key */
  apiKey: string;

  /** Request timeout in ms (default 800ms) */
  timeoutMs?: number;

  /**
   * Fail closed (deny) on network/timeouts.
   * Recommended true for security endpoints.
   * Default: true
   */
  failClosed?: boolean;
}

export class GuardClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private failClosed: boolean;

  constructor(opts: GuardClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 800;
    this.failClosed = opts.failClosed ?? true;
  }

  /**
   * Ask Guard whether this request should be allowed.
   * `route` should match the logical endpoint in client's app (e.g. "/api/login").
   */

  async check(route: string, method?: string): Promise<GuardDecision> {
    if (!route || typeof route !== "string") {
      return { allowed: false, reason: "ROUTE_REQUIRED" };
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({ route, method }),
        signal: controller.signal,
      });

      // Try to parse JSON always
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      // Normalize the response into GuardDecision
      if (data && typeof data.allowed === "boolean") {
        return data as GuardDecision;
      }

      // If server sent an error shape, map it
      if (data?.error === "ROUTE_REQUIRED") {
        return { allowed: false, reason: "ROUTE_REQUIRED" };
      }
      if (data?.error === "Unauthorized" || res.status === 401) {
        return { allowed: false, reason: "UNAUTHORIZED" };
      }

      // Unknown shape → treat as service unavailable
      return this.failClosed
        ? { allowed: false, reason: "SERVICE_UNAVAILABLE" }
        : { allowed: true };
    } catch {
      return this.failClosed
        ? { allowed: false, reason: "SERVICE_UNAVAILABLE" }
        : { allowed: true };
    } finally {
      clearTimeout(t);
    }
  }
}

/**
 * Functional convenience wrapper
 */
export async function protect(
  route: string,
  opts: GuardClientOptions,
  method?: string,
): Promise<GuardDecision> {
  const client = new GuardClient(opts);
  return client.check(route, method);
}
