"use client";

import { useState } from "react";
import { CircleUser, Database, Workflow } from "lucide-react";
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

import { OracleIcon } from "./oracle-icon";

interface TabOpen {
  oracles: boolean;
  routes: boolean;
  workflows: boolean;
  dataResources: boolean;
}

const initialState: TabOpen = {
  oracles: true,
  routes: false,
  workflows: false,
  dataResources: false,
};

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  const [tabOpen, setTabOpen] = useState<TabOpen>(initialState);

  return (
    <div className="sticky top-14 z-40 flex h-[calc(100dvh-57px)] bg-muted">
      <div className="flex w-14 flex-col items-center justify-between border-r p-4">
        <div className="flex flex-col gap-2">
          <Button
            className={cn({
              "bg-accent": tabOpen.oracles,
            })}
            onClick={() =>
              setTabOpen({
                oracles: !tabOpen.oracles,
                routes: false,
                workflows: false,
                dataResources: false,
              })
            }
            size="icon"
            variant="ghost"
          >
            <OracleIcon className="size-4 fill-foreground stroke-foreground" />
          </Button>
          <Button
            className={cn({
              "bg-accent": tabOpen.routes,
            })}
            onClick={() =>
              setTabOpen({
                oracles: false,
                routes: !tabOpen.routes,
                workflows: false,
                dataResources: false,
              })
            }
            size="icon"
            variant="ghost"
          >
            <span className="text-[10px]">HTTP</span>
          </Button>
          <Button
            className={cn({
              "bg-accent": tabOpen.workflows,
            })}
            onClick={() =>
              setTabOpen({
                oracles: false,
                routes: false,
                workflows: !tabOpen.workflows,
                dataResources: false,
              })
            }
            size="icon"
            variant="ghost"
          >
            <Workflow className="size-5 stroke-1" />
          </Button>
          <Button
            className={cn({
              "bg-accent": tabOpen.dataResources,
            })}
            onClick={() =>
              setTabOpen({
                oracles: false,
                routes: false,
                workflows: false,
                dataResources: !tabOpen.dataResources,
              })
            }
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
                  <DropdownMenuRadioGroup
                    onValueChange={setTheme}
                    value={theme}
                  >
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
      <div
        className={cn(
          "flex w-64 flex-col items-center justify-center border-r bg-muted",
          {
            hidden: !tabOpen.oracles,
          },
        )}
      >
        <div>Todo</div>
        <div>Oracles</div>
      </div>
      <div
        className={cn(
          "flex w-64 flex-col items-center justify-center border-r bg-muted",
          {
            hidden: !tabOpen.routes,
          },
        )}
      >
        <div>Todo</div>
        <div>Routes</div>
      </div>
      <div
        className={cn(
          "flex w-64 flex-col items-center justify-center border-r bg-muted",
          {
            hidden: !tabOpen.workflows,
          },
        )}
      >
        <div>Todo</div>
        <div>Workflows</div>
      </div>
      <div
        className={cn(
          "flex w-64 flex-col items-center justify-center border-r bg-muted",
          {
            hidden: !tabOpen.dataResources,
          },
        )}
      >
        <div>Todo</div>
        <div>Data Resources</div>
      </div>
    </div>
  );
}
