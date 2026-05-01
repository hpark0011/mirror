export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local or .env.test before running e2e tests.`,
    );
  }
  return value;
}
