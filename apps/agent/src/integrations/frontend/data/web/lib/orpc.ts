import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin, DedupeRequestsPlugin } from "@orpc/client/plugins";
import type { RouterClient } from "@orpc/server";
import {
  createTanstackQueryUtils,
  type RouterUtils,
} from "@orpc/tanstack-query";
import type { router } from "@server/orpc/router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getHeaders } from "@tanstack/react-start/server";

export type ORPCReactUtils = RouterUtils<RouterClient<typeof router>>;

const getORPCClient = (): RouterClient<typeof router> => {
	const link = new RPCLink({
		url: new URL(
			"/api/rpc",
			typeof window !== "undefined"
				? window.location.href
				: "http://localhost:3000",
		),
		headers: createIsomorphicFn()
			.client(() => ({}))
			.server(() => getHeaders()),
		plugins: [
			new BatchLinkPlugin({
				headers: createIsomorphicFn()
					.client(() => ({}))
					.server(() => getHeaders()),
				groups: [
					{
						condition: () => true,
						context: {},
					},
				],
			}),
			new DedupeRequestsPlugin({
				groups: [
					{
						condition: () => true,
						context: {},
					},
				],
			}),
		],
	});

	return createORPCClient(link);
};

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
