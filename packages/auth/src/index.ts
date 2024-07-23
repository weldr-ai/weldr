import type { NextAuthResult } from "next-auth";
import NextAuth from "next-auth";

import { authConfig } from "./config";

export type { Session } from "next-auth";

export const { handlers, auth, signIn, signOut }: NextAuthResult =
  NextAuth(authConfig);

export { invalidateSessionToken, validateToken } from "./config";
