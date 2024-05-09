import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@integramind/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@integramind/ui/sheet";

interface Link {
  id: string;
  title: string;
  path: string;
}

const links: Link[] = [];

export function Navbar(): JSX.Element {
  return (
    <header className="sticky top-0 flex h-14 items-center gap-4 border-b pr-4 md:pr-6">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <Link
          className="flex size-14 items-center justify-center gap-2 border-r text-lg font-semibold md:text-base"
          href="#"
        >
          <Image
            alt="IntegraMind"
            height={40}
            priority
            src="logo.svg"
            width={40}
          />
          <span className="sr-only">IntegraMind</span>
        </Link>
        {links.map((link) => (
          <Link
            className="text-foreground transition-colors hover:text-foreground"
            href={link.path}
            key={link.id}
          >
            {link.title}
          </Link>
        ))}
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button className="shrink-0 md:hidden" size="icon" variant="outline">
            <Menu className="size-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              className="flex items-center gap-2 text-lg font-semibold"
              href="#"
            >
              <Image
                alt="IntegraMind"
                height={40}
                priority
                src="logo.svg"
                width={40}
              />
              <span className="sr-only">IntegraMind</span>
            </Link>
            {links.map((link) => (
              <Link
                className="hover:text-foreground"
                href={link.path}
                key={link.id}
              >
                {link.title}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
