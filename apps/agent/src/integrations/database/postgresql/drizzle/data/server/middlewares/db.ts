import { db } from "@server/db";
import { createMiddleware } from "hono/factory";
import type { HonoBindings } from "../types";

export const useDb = createMiddleware<{
	Variables: {
		db: typeof db;
	} & HonoBindings["Variables"];
}>(async (c, next) => {
	c.set("db", db);
	return next();
});
