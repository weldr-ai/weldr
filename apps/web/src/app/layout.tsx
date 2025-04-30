import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Poppins as FontSans } from "next/font/google";

import { Toaster } from "@weldr/ui/components/toaster";
import { cn } from "@weldr/ui/lib/utils";

import "@weldr/ui/styles/globals.css";

const fontSans = FontSans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Weldr",
  description:
    "Create backend APIs, automation workflows, and integrations using only plain English, no coding required!",
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL ?? ""),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
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
