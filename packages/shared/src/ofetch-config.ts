import { Logger } from "./logger";

export const ofetchConfig = ({ tag }: { tag: string }) => ({
  retry: 5,
  retryDelay: 1000,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  onRequest: (request: unknown) => {
    Logger.info(`[${tag}] Request: ${JSON.stringify(request, null, 2)}`);
  },
  onResponse: (response: unknown) => {
    Logger.info(`[${tag}] Response: ${JSON.stringify(response, null, 2)}`);
  },
  onRequestError: (error: unknown) => {
    Logger.error(`[${tag}] Request error: ${JSON.stringify(error, null, 2)}`);
    throw error;
  },
  onResponseError: (error: unknown) => {
    Logger.error(`[${tag}] Response error: ${JSON.stringify(error, null, 2)}`);
    throw error;
  },
});
