import "@weldr/ui/styles/globals.css";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { Toaster } from "@weldr/ui/toaster";
import { cn } from "@weldr/ui/utils";

import { QueryProvider } from "@/components/query-client-provider";
import { AppStateProvider } from "@/lib/store";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { HydrateClient } from "@/lib/trpc/server";
import { auth } from "@weldr/auth";
import { AuthProvider } from "@weldr/auth/provider";
import { TooltipProvider } from "@weldr/ui/tooltip";
import { ReactFlowProvider } from "@xyflow/react";
import { headers } from "next/headers";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Weldr",
  description:
    "Build LLM-powered AI agents in minutes for seamless workflow automation!",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <html lang="en" className="dark">
      <body
        className={cn(
          "flex min-h-screen w-full flex-col bg-background font-sans antialiased",
          poppins.variable,
        )}
        suppressHydrationWarning
      >
        <AppStateProvider>
          <TRPCReactProvider>
            <QueryProvider>
              <HydrateClient>
                <AuthProvider user={session?.user ?? null}>
                  <TooltipProvider delayDuration={200}>
                    <ReactFlowProvider>
                      {children}
                      <Toaster />
                    </ReactFlowProvider>
                  </TooltipProvider>
                </AuthProvider>
              </HydrateClient>
            </QueryProvider>
          </TRPCReactProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
