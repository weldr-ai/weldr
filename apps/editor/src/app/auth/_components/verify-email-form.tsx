"use client";

import { buttonVariants } from "@weldr/ui/button";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="flex w-full flex-col items-center justify-center gap-2">
        <LogoIcon className="size-20" />
        <h3 className="text-xl">Email verified successfully!</h3>
        <div className="flex flex-col items-center justify-center">
          <p>Your email has been verified.</p>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "default" }), "mt-4")}
          >
            Start Building!
          </Link>
        </div>
        <span className="font-semibold">{email}</span>
      </div>
    </div>
  );
}
