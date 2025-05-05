import { auth } from "@weldr/auth";
import { headers } from "next/headers";

import { CommandCenter } from "@/components/command-center";
import { MainDropdownMenu } from "@/components/main-dropdown-menu";
import { api } from "@/lib/trpc/server";
import { buttonVariants } from "@weldr/ui/components/button";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import Link from "next/link";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });
  const projects = session ? await api.projects.list() : [];

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-between">
      <div className="z-50 flex w-full items-center justify-between p-2">
        {session && <MainDropdownMenu />}
        {!session && (
          <>
            <div
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-8",
              )}
            >
              <LogoIcon className="size-6" />
              <span className="sr-only">Weldr</span>
            </div>
            <div className="flex gap-2">
              <Link
                href="/auth/sign-up"
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Sign Up
              </Link>
              <Link
                href="/auth/sign-in"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Login
              </Link>
            </div>
          </>
        )}
      </div>
      <div className="flex w-full flex-1 items-center justify-center">
        <CommandCenter projects={projects} asDialog={false} view="create" />
      </div>
      <div className="flex w-full items-center justify-between p-2">
        <p className="text-muted-foreground text-xs">
          © {new Date().getFullYear()} Weldr. All rights reserved.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="https://discord.gg/rWwHazMJzE"
            className={cn(
              buttonVariants({ variant: "link" }),
              "h-fit p-0 text-muted-foreground text-xs hover:text-foreground hover:no-underline",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Discord
          </Link>
          <Link
            href="https://twitter.com/weldr_ai"
            className={cn(
              buttonVariants({ variant: "link" }),
              "h-fit p-0 text-muted-foreground text-xs hover:text-foreground hover:no-underline",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            X/Twitter
          </Link>
          <Link
            href="https://www.linkedin.com/company/weldr"
            className={cn(
              buttonVariants({ variant: "link" }),
              "h-fit p-0 text-muted-foreground text-xs hover:text-foreground hover:no-underline",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </Link>
        </div>
      </div>
    </div>
  );
}
