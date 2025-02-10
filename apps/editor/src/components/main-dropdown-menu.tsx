"use client";

import { authClient } from "@weldr/auth/client";

import {
  BookOpenIcon,
  BoxesIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  HelpCircleIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";

import { useCommandCenter } from "@/lib/store";
import { Button } from "@weldr/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@weldr/ui/dropdown-menu";
import { LogoIcon } from "@weldr/ui/icons/logo-icon";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function MainDropdownMenu(): JSX.Element {
  const router = useRouter();
  const { setOpen } = useCommandCenter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <LogoIcon className="size-10" />
          <span className="sr-only">Weldr</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" side="bottom">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setOpen("view")}>
          <BoxesIcon className="mr-2 size-4 text-muted-foreground" />
          View All Projects
          <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] text-muted-foreground opacity-100">
            <span className="text-xs">
              {typeof window !== "undefined" &&
              window.navigator?.userAgent.toLowerCase().includes("mac")
                ? "⌘"
                : "Ctrl"}
            </span>
            k
          </kbd>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setOpen("create")}>
          <PlusIcon className="mr-2 size-4 text-muted-foreground" />
          Create Project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem>
          <SettingsIcon className="mr-2 size-4 text-muted-foreground" />
          Account Settings
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCardIcon className="mr-2 size-4 text-muted-foreground" />
          Billing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Support</DropdownMenuLabel>

        <Link href="https://weldr.ai/support" target="_blank">
          <DropdownMenuItem>
            <HelpCircleIcon className="mr-2 size-4 text-muted-foreground" />
            Help
            <ExternalLinkIcon className="ml-auto size-3 text-muted-foreground" />
          </DropdownMenuItem>
        </Link>

        <Link href="https://docs.weldr.ai" target="_blank">
          <DropdownMenuItem>
            <BookOpenIcon className="mr-2 size-4 text-muted-foreground" />
            Docs
            <ExternalLinkIcon className="ml-auto size-3 text-muted-foreground" />
          </DropdownMenuItem>
        </Link>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () =>
            await authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push("/auth/sign-in");
                },
              },
            })
          }
        >
          <LogOutIcon className="mr-2 size-4 text-muted-foreground" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
