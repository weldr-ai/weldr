"use client";

import { PanelLeftClose } from "lucide-react";

import { Button } from "@integramind/ui/button";

import { useDevelopmentBarStore } from "~/lib/store";

export function DevelopmentBar() {
  const block = useDevelopmentBarStore((state) => state.block);
  const removeActiveBlock = useDevelopmentBarStore(
    (state) => state.removeActiveBlock,
  );

  return (
    <>
      {block && (
        <div className="flex h-full w-96 flex-col items-center border-r bg-muted">
          <div className="flex w-full items-center justify-between border-b px-4 py-2">
            <span className="text-xs">
              {block.type
                .split("-")
                .slice(0, -1)
                .map((word) => {
                  return word[0]!.toUpperCase() + word.substring(1);
                })
                .join(" ")}
            </span>
            <Button
              className="size-6 rounded-sm bg-muted"
              variant="outline"
              size="icon"
              onClick={() => {
                removeActiveBlock();
              }}
            >
              <PanelLeftClose className="size-3 text-muted-foreground" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
