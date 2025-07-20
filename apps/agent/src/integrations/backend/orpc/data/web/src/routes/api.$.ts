import { createServerFileRoute } from "@tanstack/react-start/server";

import server from "@repo/server/index";

async function handle({ request }: { request: Request }) {
  return server.fetch(request);
}

export const ServerRoute = createServerFileRoute("/api/$").methods({
  GET: handle,
  POST: handle,
  PUT: handle,
  DELETE: handle,
  OPTIONS: handle,
  HEAD: handle,
});
