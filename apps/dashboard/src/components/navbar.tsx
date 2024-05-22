"use client";

import Image from "next/image";
import Link from "next/link";
import { PlayCircle, Share } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@integramind/ui/button";

export function Navbar(): JSX.Element {
  const { resolvedTheme } = useTheme();

  return (
    <header className="sticky top-0 flex h-14 items-center gap-4 border-b bg-muted pr-4 md:pr-6">
      <nav className="flex w-full items-center text-sm">
        <Link
          className="flex size-14 items-center justify-center gap-2 border-r text-lg font-semibold md:text-base"
          href="#"
        >
          {resolvedTheme === "light" ? (
            <Image
              alt="IntegraMind Logo"
              height={40}
              priority
              src="logo.svg"
              width={40}
            />
          ) : (
            <Image
              alt="IntegraMind Logo"
              height={40}
              priority
              src="logo-dark.svg"
              width={40}
            />
          )}
          <span className="sr-only">IntegraMind</span>
        </Link>
      </nav>
      <div className="flex flex-row items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex min-w-20 max-w-min flex-row items-center justify-center gap-1 border border-success text-success hover:bg-success/10 hover:text-success"
        >
          <PlayCircle className="size-3.5" />
          Run
        </Button>
        <Button
          size="sm"
          className="flex min-w-20 max-w-min flex-row items-center justify-center gap-1"
        >
          <Share className="size-3.5" />
          Deploy
        </Button>
      </div>
    </header>
  );
}
