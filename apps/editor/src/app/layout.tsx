import "@weldr/ui/styles/globals.css";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { Toaster } from "@weldr/ui/toaster";
import { cn } from "@weldr/ui/utils";

import { QueryProvider } from "@/components/query-client-provider";
import { AppStateProvider } from "@/lib/store";
import { TRPCReactProvider } from "@/lib/trpc/react";
import { HydrateClient } from "@/lib/trpc/server";
import { TooltipProvider } from "@weldr/ui/tooltip";
import { ReactFlowProvider } from "@xyflow/react";

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
                <TooltipProvider delayDuration={200}>
                  <ReactFlowProvider>
                    {children}
                    <Toaster />
                  </ReactFlowProvider>
                </TooltipProvider>
              </HydrateClient>
            </QueryProvider>
          </TRPCReactProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
