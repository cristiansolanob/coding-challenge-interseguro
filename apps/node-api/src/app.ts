import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { AppConfig } from './config/env';
import { router } from './http/routes';
import { errorHandler, errors, notFoundHandler } from './http/errors';

/**
 * App factory — the single test seam. Supertest drives this in-process with
 * no port and no network. Only src/server.ts calls listen().
 */
export function createApp(_cfg: AppConfig): Express {
  const app = express();

  app.use(
    express.json({ strict: true, limit: '1mb' }),
    // Body-parse failures (malformed JSON / oversized body) must not leak
    // Express's default HTML error page — normalize to PAYLOAD_INVALID here.
    (err: unknown, _req: Request, _res: Response, next: NextFunction) => {
      if (
        err &&
        typeof err === 'object' &&
        'type' in err &&
        (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')
      ) {
        next(errors.payloadInvalid());
        return;
      }
      next(err);
    },
  );

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
