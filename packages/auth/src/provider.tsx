"use client";

import { type ReactNode, createContext, useContext } from "react";

export interface AuthContextValue {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  } | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: AuthContextValue["user"];
}) {
  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
