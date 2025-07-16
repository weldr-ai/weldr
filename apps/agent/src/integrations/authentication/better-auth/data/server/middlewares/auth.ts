import { auth } from "@server/lib/auth";
import { createMiddleware } from "hono/factory";
import type { HonoBindings } from "../types";

export const requireAuth = createMiddleware<{
	Variables: {
		session: typeof auth.$Infer.Session.session;
		user: typeof auth.$Infer.Session.user;
	} & HonoBindings["Variables"];
}>(async (c, next) => {
	const session = c.var.session
		? {
				session: c.var.session,
				user: c.var.user,
			}
		: await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		return c.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
	}

	c.set("session", session.session);
	c.set("user", session.user);

	return next();
});
