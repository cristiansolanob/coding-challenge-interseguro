import { loadConfig } from './config/env';
import { createApp } from './app';

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, () => {
  console.log(`node-api listening on port ${config.port}`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down gracefully.`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
