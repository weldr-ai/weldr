import "@integramind/ui/globals.css";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const poppins = Poppins({ weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IntegraMind",
  description:
    "Build LLM-powered AI agents in minutes for seamless workflow automation!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html className="dark" lang="en">
      <body className={poppins.className}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
