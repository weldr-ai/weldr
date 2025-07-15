import { auth } from "@server/lib/auth";
import { createServerFn } from "@tanstack/react-start";
import { getHeaders } from "@tanstack/react-start/server";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const getSessionFn = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await auth.api.getSession({
			headers: new Headers(getHeaders() as HeadersInit),
		});
		return session ?? null;
	},
);

export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
