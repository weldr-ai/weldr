"use client";

import { useState } from "react";
import { CircleUser, Database, PlusCircle } from "lucide-react";
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

import { AddOracle } from "./add-oracle";

interface TabOpen {
  add: boolean;
  oracles: boolean;
  database: boolean;
}

const initialState: TabOpen = {
  add: true,
  oracles: false,
  database: false,
};

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  const [tabOpen, setTabOpen] = useState<TabOpen>(initialState);

  return (
    <div className="sticky top-14 z-40 flex h-[calc(100dvh-57px)] bg-background">
      <div className="flex w-14 flex-col items-center justify-between border-r p-4">
        <div className="flex flex-col gap-2">
          <Button
            className={cn({
              "bg-accent": tabOpen.add,
            })}
            onClick={() =>
              setTabOpen({
                add: !tabOpen.add,
                oracles: false,
                database: false,
              })
            }
            size="icon"
            variant="ghost"
          >
            <PlusCircle className="size-5" />
          </Button>
          <Button
            className={cn({
              "bg-accent": tabOpen.oracles,
            })}
            onClick={() =>
              setTabOpen({
                add: false,
                oracles: !tabOpen.oracles,
                database: false,
              })
            }
            size="icon"
            variant="ghost"
          >
            <svg
              className="size-5 fill-foreground stroke-foreground"
              height="256px"
              width="256px"
              version="1.1"
              id="Layer_1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-10.24 -10.24 532.48 532.48"
              xmlSpace="preserve"
              strokeWidth="12.8"
              transform="rotate(0)"
            >
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.024"
              ></g>
              <g id="SVGRepo_iconCarrier">
                <g>
                  <g>
                    <path d="M423.387,427.499V384.15c37.891-43.463,58.698-98.412,58.698-155.326v-2.737C482.085,101.422,380.664,0,256.001,0 S29.916,101.422,29.916,226.085v2.737c0,56.916,20.807,111.864,58.698,155.326v43.349c-37.465,4.58-66.584,36.57-66.584,75.251 c0,5.111,4.142,9.252,9.252,9.252h449.437c5.109,0,9.252-4.141,9.252-9.252C489.97,464.067,460.852,432.079,423.387,427.499z M48.419,228.822v-2.737c0-114.462,93.121-207.582,207.582-207.582s207.582,93.12,207.582,207.582v2.737 c0,52.692-19.386,103.589-54.667,143.774h-305.83C67.805,332.411,48.419,281.514,48.419,228.822z M404.884,391.101v35.813H107.117 v-35.813H404.884z M41.279,493.497c4.437-27.229,28.122-48.081,56.586-48.081h316.27c28.464,0,52.149,20.851,56.586,48.081H41.279 z"></path>
                  </g>
                </g>
              </g>
            </svg>
          </Button>
          <Button
            className={cn({
              "bg-accent": tabOpen.database,
            })}
            onClick={() =>
              setTabOpen({
                add: false,
                oracles: false,
                database: !tabOpen.database,
              })
            }
            size="icon"
            variant="ghost"
          >
            <Database className="size-5" />
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <CircleUser className="size-5" />
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
        className={cn("w-64 border-r bg-background", {
          hidden: !tabOpen.add,
        })}
      >
        <AddOracle />
      </div>
      <div
        className={cn(
          "flex w-64 flex-col items-center justify-center border-r bg-background",
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
          "flex w-64 flex-col items-center justify-center border-r bg-background",
          {
            hidden: !tabOpen.database,
          },
        )}
      >
        <div>Todo</div>
        <div>Database</div>
      </div>
    </div>
  );
}
