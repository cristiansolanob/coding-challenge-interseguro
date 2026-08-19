export interface AppConfig {
  port: number;
}

const DEFAULT_PORT = 3001;

/**
 * Reads runtime configuration from environment variables.
 * Fails fast (throws) on an invalid PORT rather than silently falling back.
 */
export function loadConfig(): AppConfig {
  const rawPort = process.env['PORT'];

  if (rawPort === undefined || rawPort === '') {
    return { port: DEFAULT_PORT };
  }

  const port = Number(rawPort);
  if (!Number.isFinite(port) || !Number.isInteger(port)) {
    throw new Error(`Invalid PORT environment variable: "${rawPort}"`);
  }

  return { port };
}
