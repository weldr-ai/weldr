import { OpenAPIHono } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";
import type { WorkflowContext } from "@/workflow/context";

import type { SSEEvent } from "@weldr/shared/types";

export interface StreamWriter {
  write(chunk: SSEEvent): Promise<void>;
  close(): Promise<void>;
}

// Global type declarations
declare global {
  var sseConnections: Map<string, StreamWriter>;
}

export type HonoContext = {
  Variables: {
    logger: PinoLogger;
    workflowContext: WorkflowContext;
  };
};

export function createRouter() {
  return new OpenAPIHono<HonoContext>();
}

export function getSSEConnection(chatId: string): StreamWriter {
  if (!global.sseConnections) {
    global.sseConnections = new Map();
  }

  const existingConnection = global.sseConnections.get(chatId);
  if (existingConnection) {
    return existingConnection;
  }

  // Create a fallback stream writer that buffers messages until a real connection is established
  const fallbackWriter: StreamWriter = {
    write: async (chunk: SSEEvent) => {
      console.log(`[SSE Fallback] Buffering message for ${chatId}:`, chunk);
    },
    close: async () => {
      console.log(`[SSE Fallback] Would close connection for ${chatId}`);
    },
  };

  global.sseConnections.set(chatId, fallbackWriter);
  return fallbackWriter;
}

export function configureOpenAPI(app: OpenAPIHono<HonoContext>) {
  app
    .get("/openapi.json", async (c) => {
      const spec = app.getOpenAPI31Document({
        openapi: "3.1.0",
        info: {
          title: "API Documentation",
          version: "1.0.0",
        },
      });
      c.res.headers.set("Content-Type", "application/json");
      return c.json(spec);
    })
    .get("/reference", async (c) => {
      return c.html(`
				<!doctype html>
				<html>
					<head>
						<title>API Reference</title>
						<meta charset="utf-8" />
						<meta name="viewport" content="width=device-width, initial-scale=1" />
						<link rel="icon" type="image/svg+xml" href="${process.env.BASE_URL ?? "http://localhost:8080"}/logo.svg" />
					</head>
					<body>
						<div id="app"></div>
						<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
						<script>
							Scalar.createApiReference('#app', {
								url: '/openapi.json',
								authentication: {
									securitySchemes: {
										bearerAuth: {
											token: 'default-token',
										},
									},
								},
							})
						</script>
					</body>
				</html>`);
    });
}
