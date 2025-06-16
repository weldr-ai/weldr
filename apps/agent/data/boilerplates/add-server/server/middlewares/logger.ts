import { pinoLogger as logger } from "hono-pino";
import pino from "pino";

export function loggerMiddleware() {
  return logger({
    pino: pino({
      level: process.env.LOG_LEVEL || "info",
    }),
  });
}
