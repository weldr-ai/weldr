import server from "@server/api";
import { createServerFileRoute } from "@tanstack/react-start/server";

const handler = ({ request }: { request: Request }) =>
  server.fetch(request, { NODE_ENV: process.env.NODE_ENV });

export const ServerRoute = createServerFileRoute("/api/$").methods({
  GET: handler,
  POST: handler,
  PUT: handler,
  DELETE: handler,
  OPTIONS: handler,
  HEAD: handler,
});
