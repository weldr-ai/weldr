import Link from "next/link";

import { buttonVariants } from "@specly/ui/button";
import { cn } from "@specly/ui/utils";

import { LinkedInIcon } from "@specly/ui/icons/linkedin-icon";
import { XIcon } from "@specly/ui/icons/x-icon";

export function Footer() {
  return (
    <div className="flex w-full items-center justify-between border-t p-4">
      <span>© {new Date().getFullYear()} specly</span>
      <div>
        <Link
          href="https://twitter.com/specly"
          target="_blank"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "p-2 hover:bg-transparent",
          )}
        >
          <XIcon />
        </Link>
        <Link
          href="https://linkedin.com/company/specly"
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
