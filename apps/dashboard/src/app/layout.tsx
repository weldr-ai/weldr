import "@specly/ui/globals.css";

import type { Metadata } from "next";
import { Poppins as FontSans } from "next/font/google";

import { ThemeProvider } from "@specly/ui/theme-provider";
import { Toaster } from "@specly/ui/toaster";
import { cn } from "@specly/ui/utils";

import { TooltipProvider } from "@specly/ui/tooltip";
import { QueryProvider } from "~/components/query-client-provider";
import { TRPCReactProvider } from "~/lib/trpc/react";

const fontSans = FontSans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Specly",
  description:
    "Build LLM-powered AI agents in minutes for seamless workflow automation!",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  return (
    <html className="dark" lang="en">
      <body
        className={cn(
          "flex min-h-screen w-full flex-col bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <TRPCReactProvider>
            <QueryProvider>
              <TooltipProvider delayDuration={200}>
                {children}
                <Toaster />
              </TooltipProvider>
            </QueryProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
