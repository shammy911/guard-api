export const PLANS = {
  free: {
    planName: "Free",
    rpm: 30,
    monthly: 10_000,
  },
  pro: {
    planName: "Pro",
    rpm: 300,
    monthly: 300_000,
  },
  enterprise: {
    planName: "Enterprise",
    rpm: 2000,
    monthly: 2_000_000,
  },
} as const;
