import { Logger } from "@weldr/shared/logger";
import { pinoLogger } from "hono-pino";

export function loggerMiddleware() {
  return pinoLogger({
    pino: Logger.instance,
  });
}
