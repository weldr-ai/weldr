"use client";

import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/button";
import { RocketIcon } from "lucide-react";
import { MainDropdownMenu } from "./main-dropdown-menu";
import { Versions } from "./versions";

export function Navbar({
  project,
}: {
  project: RouterOutputs["projects"]["byId"];
}) {
  return (
    <div className="flex w-full items-center justify-between p-2">
      <div className="flex items-center gap-2">
        <MainDropdownMenu />
      </div>

      <h2 className="font-semibold text-sm">{project.name}</h2>

      <div className="flex items-center gap-2">
        <Versions />
        <Button size="sm" variant="outline">
          <RocketIcon className="mr-2 size-4 text-primary" />
          Publish
        </Button>
      </div>
    </div>
  );
}
