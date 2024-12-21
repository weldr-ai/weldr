import "@integramind/ui/globals.css";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { Toaster } from "@integramind/ui/toaster";
import { cn } from "@integramind/ui/utils";

import { auth } from "@integramind/auth";
import { AuthProvider } from "@integramind/auth/provider";
import { ThemeProvider } from "@integramind/ui/theme-provider";
import { TooltipProvider } from "@integramind/ui/tooltip";
import { ReactFlowProvider } from "@xyflow/react";
import { headers } from "next/headers";
import { QueryProvider } from "~/components/query-client-provider";
import { TRPCReactProvider } from "~/lib/trpc/client";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IntegraMind",
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
    <html lang="en">
      <body
        className={cn(
          "flex min-h-screen w-full flex-col bg-background font-sans antialiased",
          poppins.variable,
        )}
        suppressHydrationWarning
      >
        <AuthProvider user={session?.user ?? null}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ReactFlowProvider>
              <TRPCReactProvider>
                <QueryProvider>
                  <TooltipProvider delayDuration={200}>
                    {children}
                    <Toaster />
                  </TooltipProvider>
                </QueryProvider>
              </TRPCReactProvider>
            </ReactFlowProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
