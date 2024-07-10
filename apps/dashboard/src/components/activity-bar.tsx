"use client";

import {
  BlocksIcon,
  CircleUserIcon,
  UnplugIcon,
  WorkflowIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { cn } from "@integramind/ui/utils";

import { signOut } from "~/lib/auth/actions";
import { usePrimarySidebarStore } from "~/lib/store";

export function ActivityBar() {
  const { theme, setTheme } = useTheme();
  const activeSection = usePrimarySidebarStore((state) => state.activeSection);
  const updateActiveSection = usePrimarySidebarStore(
    (state) => state.updateActiveSection,
  );

  return (
    <div className="flex h-full w-14 flex-col items-center justify-between border-r p-4">
      <div className="flex flex-col gap-2">
        <Button
          className={cn({
            "bg-accent": activeSection === "components",
          })}
          onClick={() => updateActiveSection("components")}
          size="icon"
          variant="ghost"
        >
          <BlocksIcon className="size-5" />
        </Button>
        <Button
          className={cn({
            "bg-accent": activeSection === "routes",
          })}
          onClick={() => updateActiveSection("routes")}
          size="icon"
          variant="ghost"
        >
          <span className="text-[10px] font-bold">HTTP</span>
        </Button>
        <Button
          className={cn({
            "bg-accent": activeSection === "workflows",
          })}
          onClick={() => updateActiveSection("workflows")}
          size="icon"
          variant="ghost"
        >
          <WorkflowIcon className="size-5" />
        </Button>
        <Button
          className={cn({
            "bg-accent": activeSection === "resources",
          })}
          onClick={() => updateActiveSection("resources")}
          size="icon"
          variant="ghost"
        >
          <UnplugIcon className="size-5" />
        </Button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <CircleUserIcon className="size-5" />
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" align="end" side="right">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Appearance</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup onValueChange={setTheme} value={theme}>
                  <DropdownMenuRadioItem value="light">
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
