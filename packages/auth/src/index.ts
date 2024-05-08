import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { db } from "@integramind/db";

import { env } from "./env";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Resend({
      apiKey: env.AUTH_RESEND_KEY,
      from: "noreply@integramind.ai",
    }),
  ],
});
