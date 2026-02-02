export interface ProtectOptions {
  apiKey: string;
  endPoint?: string; //Default to hosted API
  limitPerRoute?: boolean;
}

export async function protect(
  ip: string,
  route: string,
  options: ProtectOptions,
) {
  const endpoint = options.endPoint || "https://api.guard.com/check";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-guard-key": options.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ip, route }),
  });

  const data = await res.json();
  return data; // { allowed: boolean, reason?: string, score?: number }
}
