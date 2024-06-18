import "@integramind/ui/globals.css";

import type { Metadata } from "next";
import { Poppins as FontSans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

import { Toaster } from "@integramind/ui/toaster";
import { cn } from "@integramind/ui/utils";

const fontSans = FontSans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "IntegraMind",
  description:
    "Build custom backends, automate workflows, and integrate data effortlessly with our advanced platform. No coding necessary, just English!",
  metadataBase: new URL("https://integramind.ai"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body
        className={cn(
          "flex min-h-screen w-full items-center justify-center bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        {children}
        <Analytics />
        <Toaster />
      </body>
    </html>
  );
}
