import "@integramind/ui/globals.css";

import type { Metadata } from "next";
import { Poppins as FontSans } from "next/font/google";

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
    "Unlock the potential of our advanced platform to build tailor-made backends, automate workflows, and integrate data effortlessly. No coding necessary, just English!",
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
          "flex min-h-screen w-full bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
