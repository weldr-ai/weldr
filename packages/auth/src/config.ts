import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type {
  DefaultSession,
  NextAuthConfig,
  Session as NextAuthSession,
} from "next-auth";
import Resend from "next-auth/providers/resend";

import { db } from "@integramind/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@integramind/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

const adapter = DrizzleAdapter(db, {
  usersTable: users,
  // @ts-ignore
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
  authenticatorsTable: authenticators,
});

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/auth/sign-in",
    signOut: "/auth/sign-out",
    error: "/auth/error",
    verifyRequest: "/auth/verify-email",
  },
  adapter,
  secret: process.env.AUTH_SECRET,
  providers: [
    Resend({
      from: "IntegraMind <noreply@integramind.ai>",
      apiKey: process.env.RESEND_API_KEY,
    }),
  ],
  callbacks: {
    session: (opts) => {
      if (!("user" in opts))
        throw new Error("unreachable with session strategy");

      return {
        ...opts.session,
        user: {
          ...opts.session.user,
          id: opts.user.id,
        },
      };
    },
  },
} satisfies NextAuthConfig;

export const validateToken = async (
  token: string,
): Promise<NextAuthSession | null> => {
  const sessionToken = token.slice("Bearer ".length);
  const session = await adapter.getSessionAndUser?.(sessionToken);
  return session
    ? {
        user: {
          ...session.user,
        },
        expires: session.session.expires.toISOString(),
      }
    : null;
};

export const invalidateSessionToken = async (token: string) => {
  await adapter.deleteSession?.(token);
};
