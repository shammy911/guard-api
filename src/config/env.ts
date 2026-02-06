function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3000),

  JWT_SECRET: requireEnv("JWT_SECRET"),

  RATE_LIMIT: {
    MAX: Number(process.env.RATE_LIMIT_MAX ?? 100),
    WINDOW: Number(process.env.RATE_LIMIT_WINDOW ?? 60000),
  },
};
