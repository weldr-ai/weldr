import { createServer } from "node:http";
import { OpenAPIHandler } from "@orpc/openapi/node";
import pinoHttp from "pino-http";

import { openApiHandlerOptions } from "./lib/handlers";
import { logger } from "./lib/logger";
import { nanoid } from "./lib/nanoid";
import { router } from "./router";

const httLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers["x-request-id"] || nanoid(),
});

export const handler = new OpenAPIHandler(router, openApiHandlerOptions);

const server = createServer(async (req, res) => {
  httLogger(req, res);

  const result = await handler.handle(req, res, {
    context: {
      logger: httLogger.logger,
      headers: new Headers(req.headers as HeadersInit),
    },
  });

  if (result.matched) {
    return;
  }

  if (!result.matched) {
    res.statusCode = 404;
    res.end("No procedure matched");
  }
});

const port = Number(process.env.PORT ?? 3000);

server.listen(port, "0.0.0.0", () =>
  console.log(`Listening on http://localhost:${port}`),
);
