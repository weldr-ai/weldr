import "@integramind/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Poppins as FontSans } from "next/font/google";

import { ThemeProvider } from "@integramind/ui/theme-provider";
import { Toaster } from "@integramind/ui/toaster";
import { cn } from "@integramind/ui/utils";

import { QueryProvider } from "~/components/query-client-provider";
import { TRPCReactProvider } from "~/lib/trpc/react";

const fontSans = FontSans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
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
              {children}
              <Toaster />
              <Analytics />
              <SpeedInsights />
            </QueryProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
