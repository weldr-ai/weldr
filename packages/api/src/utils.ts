import { TRPCError } from "@trpc/server";

export async function callAgentProxy<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  requestHeaders?: Headers,
): Promise<T> {
  // Get base URL from environment or default to localhost
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const proxyUrl = `${baseUrl}/api/proxy`;

  const proxyHeaders = new Headers();
  proxyHeaders.set("content-type", "application/json");

  // Copy all headers from the original request
  requestHeaders?.forEach((value, key) => {
    proxyHeaders.set(key, value);
  });

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: proxyHeaders,
    body: JSON.stringify({
      endpoint,
      ...body,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: errorData.error || "Agent proxy request failed",
    });
  }

  return response.json() as Promise<T>;
}
