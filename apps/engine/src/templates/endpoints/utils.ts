import type { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { Readable } from "node:stream";
import { type H3Event, createEvent } from "h3";

interface MockRequestOptions {
  method?: string;
  url?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function testEndpoint(
  handler: (event: H3Event) => Promise<unknown>,
  options: MockRequestOptions = {},
) {
  // Default options
  const {
    method = "GET",
    url = "/",
    query = {},
    params = {},
    body = undefined,
    headers = {},
  } = options;

  // Create mock socket
  const socket = new Socket();

  // Prepare headers with proper content-type
  const requestHeaders = {
    "content-type": "application/json",
    ...headers,
    "content-length": body
      ? Buffer.from(JSON.stringify(body)).length.toString()
      : "0",
  };

  // Create mock request extending IncomingMessage
  const req = Object.assign(new Readable(), {
    socket,
    headers: requestHeaders,
    method,
    url: url + createQueryString(query),
    httpVersion: "1.1",
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    complete: true,
    rawHeaders: Object.entries(requestHeaders).flat(),
    rawTrailers: [],
    setTimeout: (msecs: number, callback: () => void) =>
      socket.setTimeout(msecs, callback),
    trailers: {},
    readable: true,
    // Add header getter method
    get: function (header: string) {
      return this.headers[header.toLowerCase() as keyof typeof this.headers];
    },
  }) as unknown as IncomingMessage;

  // Add body to readable stream if provided
  if (body) {
    const bodyString = JSON.stringify(body);
    req.push(bodyString);
  }

  req.push(null); // Signal end of stream

  // Create mock response extending ServerResponse
  const res = Object.assign(new Readable(), {
    socket,
    headersSent: false,
    statusCode: 200,
    setHeader: () => {},
    getHeader: () => {},
    removeHeader: () => {},
    getHeaderNames: () => [],
    hasHeader: () => false,
    writeHead: (statusCode: number) => {
      res.statusCode = statusCode;
      return res;
    },
    end: () => {},
  }) as unknown as ServerResponse;

  // Create H3 event
  const event = createEvent(req, res);

  // Add params to event context
  event.context.params = params;

  // Run the handler
  try {
    const response = await handler(event);
    return response;
  } catch (error) {
    throw error as Error;
  }
}

function createQueryString(query: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.append(key, value);
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
