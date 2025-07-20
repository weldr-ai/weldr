import { auth } from "./lib/auth";
import { openApiHandler, rpcHandler } from "./lib/handlers";
import { logger } from "./lib/logger";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/rpc")) {
      const result = await rpcHandler.handle(request, {
        prefix: "/rpc",
        context: {
          logger,
          headers: new Headers(request.headers as HeadersInit),
        },
      });

      if (result.matched) {
        return result.response;
      }

      return new Response("Not found", { status: 404 });
    }

    if (url.pathname.startsWith("/api/auth")) {
      return auth.handler(request);
    }

    if (url.pathname.startsWith("/api")) {
      const result = await openApiHandler.handle(request, {
        prefix: "/api",
        context: {
          logger,
          headers: new Headers(request.headers as HeadersInit),
        },
      });

      if (result.matched) {
        return result.response;
      }

      return new Response("Not found", { status: 404 });
    }

    return new Response("Not found", { status: 404 });
  },
};
