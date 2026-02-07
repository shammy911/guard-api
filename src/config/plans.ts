export const PLANS = {
  free: {
    rpm: 30,
    monthly: 10_000,
  },
  pro: {
    rpm: 300,
    monthly: 300_000,
  },
  enterprise: {
    rpm: 2000,
  },
} as const;
