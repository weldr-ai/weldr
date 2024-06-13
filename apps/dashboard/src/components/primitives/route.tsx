"use client";

import { memo } from "react";
import Link from "next/link";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
} from "lucide-react";
import { Handle, Position, useReactFlow } from "reactflow";

import { Badge } from "@integramind/ui/badge";
import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@integramind/ui/expandable-card";
import { cn } from "@integramind/ui/utils";

import type { RouteNodeProps } from "~/types";

export const Route = memo(
  ({ data, isConnectable, xPos, yPos, selected }: RouteNodeProps) => {
    const reactFlow = useReactFlow();

    return (
      <>
        <ExpandableCard>
          <ExpandableCardTrigger>
            <Card
              className={cn(
                "drag-handle flex h-[84px] w-[256px] flex-col gap-2 px-5 py-4",
                {
                  "border-primary": selected,
                },
              )}
              onClick={() => {
                reactFlow.fitBounds(
                  {
                    x: xPos,
                    y: yPos,
                    width: 400,
                    height: 400 + 300,
                  },
                  {
                    duration: 500,
                  },
                );
              }}
            >
              <div className="flex w-full items-center gap-2 text-xs">
                <Badge>{data.actionType}</Badge>
                <span className="text-muted-foreground">Route</span>
              </div>
              <span className="flex w-full justify-start text-sm">
                {data.name}
              </span>
            </Card>
          </ExpandableCardTrigger>
          <ExpandableCardContent className="flex h-[400px] flex-col p-0">
            <ExpandableCardHeader className="flex flex-col items-start justify-start px-6 py-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    {data.actionType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Route</span>
                </div>
                <div className="flex items-center">
                  <Button
                    className="size-7 text-success hover:text-success"
                    variant="ghost"
                    size="icon"
                  >
                    <PlayCircleIcon className="size-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button
                        className="size-7 text-muted-foreground hover:text-muted-foreground"
                        variant="ghost"
                        size="icon"
                      >
                        <EllipsisVerticalIcon className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuLabel className="text-xs">
                        Route
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-xs">
                        <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                        Run
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center justify-between text-xs">
                        <Link
                          className="flex items-center"
                          href="https://docs.integramind.ai/primitives/route"
                          target="blank"
                        >
                          <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
                          Docs
                        </Link>
                        <ExternalLinkIcon className="size-3 text-muted-foreground" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </ExpandableCardHeader>
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          type="target"
          className="border-border bg-background p-1"
          position={Position.Right}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
      </>
    );
  },
);

Route.displayName = "Route";
