import { db } from "@server/db";
import { base } from "@server/orpc/utils";

export const useDb = base.middleware(async ({ context, next }) => {
	return next({
		context: {
			db: context.db ?? db,
		},
	});
});
