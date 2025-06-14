export const ofetchConfig = ({ tag }: { tag: string }) => ({
  retry: 5,
  retryDelay: 1000,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  onRequest: (request: unknown) => {
    console.log(`[${tag}] Request: ${JSON.stringify(request, null, 2)}`);
  },
  onResponse: (response: unknown) => {
    console.log(`[${tag}] Response: ${JSON.stringify(response, null, 2)}`);
  },
  onRequestError: (error: unknown) => {
    console.error(`[${tag}] Request error: ${JSON.stringify(error, null, 2)}`);
    throw error;
  },
  onResponseError: (error: unknown) => {
    console.error(`[${tag}] Response error: ${JSON.stringify(error, null, 2)}`);
    throw error;
  },
});
