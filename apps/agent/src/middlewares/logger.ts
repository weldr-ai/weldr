import { Logger } from "@/lib/logger";
import { pinoLogger } from "hono-pino";

export function loggerMiddleware() {
  return pinoLogger({
    pino: Logger.get().raw,
  });
}
