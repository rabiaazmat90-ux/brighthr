/**
 * Reads a required environment variable and fails with a clear message.
 *
 * WHY: without this, a missing .env / missing GitHub secret shows up later as a
 * confusing "element not found" on the login page. Failing fast with a plain
 * message saves debugging time for whoever runs the suite next.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing environment variable ${name}. ` +
        `Locally: add it to the .env file (see .env.example). ` +
        `In CI: add it under Settings > Secrets and variables > Actions.`,
    );
  }
  return value.trim();
}
