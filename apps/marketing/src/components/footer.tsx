import Link from "next/link";

import { buttonVariants } from "@integramind/ui/button";
import { cn } from "@integramind/ui/utils";

import { LinkedInIcon } from "~/components/ui/icons/linkedin-icon";
import { XIcon } from "~/components/ui/icons/x-icon";

export function Footer() {
  return (
    <div className="flex w-full items-center justify-between border-t p-4">
      <span>© {new Date().getFullYear()} IntegraMind</span>
      <div>
        <Link
          href="https://twitter.com/integramind"
          target="_blank"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "p-2 hover:bg-transparent",
          )}
        >
          <XIcon />
        </Link>
        <Link
          href="https://linkedin.com/company/integramind"
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
