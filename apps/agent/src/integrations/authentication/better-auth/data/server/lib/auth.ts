import { db } from "@server/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { reactStartCookies } from "better-auth/react-start";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
	}),
	emailAndPassword: {
		enabled: true,
	},
	trustedOrigins: process.env.CORS_HOST?.split(",") ?? [],
	plugins: [reactStartCookies()],
});

export type Session = typeof auth.$Infer.Session;
