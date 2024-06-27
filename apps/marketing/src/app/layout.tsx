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
    "Build backend APIs, workflows, and data pipelines with no coding, just English!",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? ""),
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
