import { ORPCError } from "@orpc/server";
import { auth } from "@server/lib/auth";
import { base } from "@server/orpc/utils";

export const requireAuth = base.middleware(async ({ context, next }) => {
	const data = context.session
		? {
				session: context.session,
				user: context.user,
			}
		: await auth.api.getSession({
				headers: context.headers,
			});

	if (!data?.session || !data?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}

	return next({
		context: {
			session: data.session,
			user: data.user,
		},
	});
});
