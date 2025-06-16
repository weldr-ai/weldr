import type { PinoLogger } from "hono-pino";

export type HonoBindings = {
  Variables: {
    logger: PinoLogger;
  };
};
