"use client";

import { Blocks, CircleUser, Database, Workflow } from "lucide-react";
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

import { usePrimarySidebarStore } from "~/lib/store";

export function ActivityBar() {
  const { theme, setTheme } = useTheme();
  const activeSection = usePrimarySidebarStore((state) => state.activeSection);
  const updateActiveSection = usePrimarySidebarStore(
    (state) => state.updateActiveSection,
  );
  const hidePrimaryBar = usePrimarySidebarStore(
    (state) => state.hidePrimaryBar,
  );

  const handleOnClick = (
    section: "blocks" | "routes" | "workflows" | "data-resources",
  ) => {
    if (activeSection !== section) {
      updateActiveSection(section);
    } else {
      hidePrimaryBar();
    }
  };

  return (
    <div className="flex w-14 flex-col items-center justify-between border-r p-4">
      <div className="flex flex-col gap-2">
        <Button
          className={cn({
            "bg-accent": activeSection === "blocks",
          })}
          onClick={() => handleOnClick("blocks")}
          size="icon"
          variant="ghost"
        >
          <Blocks className="size-5 stroke-1" />
        </Button>
        <Button
          className={cn({
            "bg-accent": activeSection === "routes",
          })}
          onClick={() => handleOnClick("routes")}
          size="icon"
          variant="ghost"
        >
          <span className="text-[10px]">HTTP</span>
        </Button>
        <Button
          className={cn({
            "bg-accent": activeSection === "workflows",
          })}
          onClick={() => handleOnClick("workflows")}
          size="icon"
          variant="ghost"
        >
          <Workflow className="size-5 stroke-1" />
        </Button>
        <Button
          className={cn({
            "bg-accent": activeSection === "data-resources",
          })}
          onClick={() => handleOnClick("data-resources")}
          size="icon"
          variant="ghost"
        >
          <Database className="size-5 stroke-1" />
        </Button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <CircleUser className="size-5 stroke-1" />
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
          <DropdownMenuItem>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
