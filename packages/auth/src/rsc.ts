import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

export type { Session } from "next-auth";

const { handlers, auth: defaultAuth, signIn, signOut } = NextAuth(authConfig);

/**
 * This is the main way to get session data for your RSCs.
 * This will de-duplicate all calls to next-auth's default `auth()` function and only call it once per request
 */
const auth: () => Promise<DefaultSession | null> = cache(defaultAuth);

export { auth, handlers, signIn, signOut };

export { invalidateSessionToken, validateToken } from "./config";
