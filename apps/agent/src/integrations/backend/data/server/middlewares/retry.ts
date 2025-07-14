import { createMiddleware } from "hono/factory";

export function retry(options: { times: number }) {
	return createMiddleware<{
		Variables: {
			canRetry?: boolean;
		};
	}>(async (c, next) => {
		const canRetry = c.get("canRetry") ?? true;

		if (!canRetry) {
			return next();
		}

		let times = 0;
		while (true) {
			try {
				// Set canRetry to false to prevent infinite loops in nested calls
				c.set("canRetry", false);
				return await next();
			} catch (e) {
				if (times >= options.times) {
					throw e;
				}

				times++;
				// Reset canRetry for the next attempt
				c.set("canRetry", true);
			}
		}
	});
}
