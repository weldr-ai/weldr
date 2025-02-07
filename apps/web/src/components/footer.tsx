import Link from "next/link";

import { buttonVariants } from "@weldr/ui/button";
import { cn } from "@weldr/ui/utils";

import { LinkedInIcon } from "@weldr/ui/icons/linkedin-icon";
import { XIcon } from "@weldr/ui/icons/x-icon";

export function Footer() {
  return (
    <div className="flex w-full items-center justify-between border-t p-4">
      <span>© {new Date().getFullYear()} Weldr</span>
      <div>
        <Link
          href="https://twitter.com/weldr"
          target="_blank"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "p-2 hover:bg-transparent",
          )}
        >
          <XIcon />
        </Link>
        <Link
          href="https://linkedin.com/company/weldr"
          target="_blank"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "p-2 hover:bg-transparent",
          )}
        >
          <LinkedInIcon />
        </Link>
      </div>
    </div>
  );
}
