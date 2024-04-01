import "@repo/ui/globals.css";
import "./styles.css";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "@repo/ui/theme-provider";
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          {children}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
