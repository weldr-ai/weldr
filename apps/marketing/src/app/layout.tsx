import "@specly/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Poppins as FontSans } from "next/font/google";

import { Toaster } from "@specly/ui/toaster";
import { cn } from "@specly/ui/utils";

const fontSans = FontSans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Specly",
  description:
    "Create backend APIs, automation workflows, and integrations using only plain English, no coding required!",
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
