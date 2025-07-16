import type { PinoLogger } from "hono-pino";

export type ORPCContext = {
  logger: PinoLogger;
  headers: Headers;
};
