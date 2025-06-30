import OpenApiEndpointDocs from "@/components/openapi-endpoint-docs";
import { useTRPC } from "@/lib/trpc/react";
import type { CanvasNodeProps } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@weldr/ui/components/badge";
import { Card } from "@weldr/ui/components/card";
import { ScrollArea } from "@weldr/ui/components/scroll-area";
import { cn } from "@weldr/ui/lib/utils";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { OpenAPIV3 } from "openapi-types";
import { memo, useEffect, useRef, useState } from "react";
import { ProtectedBadge } from "../components/protected-badge";
import { Status } from "../components/status";

export const EndpointNode = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
  }: CanvasNodeProps) => {
    // Only handle endpoint declarations
    if (_data.specs?.data.type !== "endpoint") {
      return null;
    }

    const trpc = useTRPC();

    const { data: declaration } = useQuery(
      trpc.declarations.byId.queryOptions(
        {
          id: _data.id,
        },
        {
          initialData: _data,
        },
      ),
    );

    const { fitBounds } = useReactFlow();

    const [isExpanded, setIsExpanded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Handle click outside to collapse
    useEffect(() => {
      const handleClickOutside = (event: Event) => {
        if (
          isExpanded &&
          cardRef.current &&
          !cardRef.current.contains(event.target as Node)
        ) {
          setIsExpanded(false);
          // Call onCollapse callback if it exists
          if (
            "onCollapse" in _data &&
            typeof (_data as unknown as Record<string, unknown>).onCollapse ===
              "function"
          ) {
            (
              (_data as unknown as Record<string, unknown>)
                .onCollapse as () => void
            )();
          }
        }
      };

      const handleDocumentClick = (event: MouseEvent) => {
        if (
          isExpanded &&
          cardRef.current &&
          !cardRef.current.contains(event.target as Node)
        ) {
          setIsExpanded(false);
          // Call onCollapse callback if it exists
          if (
            "onCollapse" in _data &&
            typeof (_data as unknown as Record<string, unknown>).onCollapse ===
              "function"
          ) {
            (
              (_data as unknown as Record<string, unknown>)
                .onCollapse as () => void
            )();
          }
        }
      };

      if (isExpanded) {
        // Find the React Flow container and listen to it
        const reactFlowContainer = document.querySelector(".react-flow");
        if (reactFlowContainer) {
          reactFlowContainer.addEventListener("click", handleClickOutside);
        }
        // Also listen to document as fallback
        document.addEventListener("click", handleDocumentClick);
      }

      return () => {
        const reactFlowContainer = document.querySelector(".react-flow");
        if (reactFlowContainer) {
          reactFlowContainer.removeEventListener("click", handleClickOutside);
        }
        document.removeEventListener("click", handleDocumentClick);
      };
    }, [isExpanded]);

    if (!declaration.specs || declaration.specs.data.type !== "endpoint") {
      return null;
    }

    const endpointData = declaration.specs.data;

    const handleCardClick = () => {
      if (!isExpanded && declaration.progress === "completed") {
        setIsExpanded(true);
        // Call onExpand callback if it exists
        if (
          "onExpand" in _data &&
          typeof (_data as unknown as Record<string, unknown>).onExpand ===
            "function"
        ) {
          (
            (_data as unknown as Record<string, unknown>).onExpand as () => void
          )();
        }
        fitBounds(
          {
            x: positionAbsoluteX,
            y: positionAbsoluteY - 150,
            width: 300,
            height: 800,
          },
          {
            duration: 500,
          },
        );
      }
    };

    return (
      <>
        <Card
          ref={cardRef}
          className={cn(
            "drag-handle origin-center cursor-pointer p-0 transition-all duration-300 ease-in-out dark:bg-muted",
            {
              "border-primary": selected,
              "max-h-[400px] w-[256px]": !isExpanded,
              "-translate-x-[72px] -translate-y-[108px] h-[400px] w-[500px]":
                isExpanded,
            },
          )}
          onClick={handleCardClick}
        >
          {!isExpanded ? (
            // Collapsed view
            <div className="flex size-full flex-col items-start justify-center gap-2 p-3">
              <div className="flex w-full items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-1 text-xs">
                  {declaration.progress !== "completed" && (
                    <Status progress={declaration.progress} />
                  )}
                  <Badge
                    className={cn("shrink-0 font-bold uppercase", {
                      "bg-primary/30 text-primary":
                        endpointData.method === "get",
                      "bg-success/30 text-success":
                        endpointData.method === "post",
                      "bg-warning/30 text-warning":
                        endpointData.method === "put",
                      "bg-destructive/30 text-destructive":
                        endpointData.method === "delete",
                      "p-0 font-semibold text-primary text-xs":
                        !endpointData.method,
                    })}
                  >
                    {endpointData.method?.toUpperCase() || "API"}
                  </Badge>
                  <span className="truncate font-mono text-xs">
                    {(endpointData.path || "/api/endpoint")
                      .split(/(\{[^}]+\})/)
                      .map((part) => (
                        <span
                          key={part || `path-segment-${Math.random()}`}
                          className={cn(
                            part.startsWith("{") && part.endsWith("}")
                              ? "font-medium text-warning"
                              : "text-muted-foreground",
                          )}
                        >
                          {part}
                        </span>
                      ))}
                  </span>
                </div>
                <ProtectedBadge protected={endpointData.protected ?? false} />
              </div>
              {endpointData.summary && (
                <span className="w-full truncate text-start text-sm">
                  {endpointData.summary}
                </span>
              )}
              {endpointData.description && (
                <span className="w-full text-start text-muted-foreground text-xs">
                  {endpointData.description}
                </span>
              )}
            </div>
          ) : (
            // Expanded view
            <div className="nowheel flex h-full w-full cursor-default flex-col">
              {/* Header */}
              <div className="flex flex-col items-start justify-start gap-2 border-b p-4">
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-primary text-xs">
                      REST
                    </span>
                    <span className="text-muted-foreground">Endpoint</span>
                  </div>
                  <ProtectedBadge protected={endpointData.protected ?? false} />
                </div>
                <h3 className="text-sm">
                  {endpointData.summary || endpointData.path || "API Endpoint"}
                </h3>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 overflow-hidden p-4">
                <OpenApiEndpointDocs
                  spec={
                    endpointData
                      ? ({
                          openapi: "3.0.0",
                          info: {
                            title: "Sample API",
                            version: "1.0.0",
                          },
                          paths: {
                            [endpointData.path]: {
                              [endpointData.method]: endpointData,
                            },
                          },
                        } as OpenAPIV3.Document)
                      : null
                  }
                />
              </ScrollArea>
            </div>
          )}
        </Card>

        <Handle
          className={cn("opacity-0")}
          type="target"
          position={Position.Left}
          isConnectable={false}
        />
        <Handle
          className={cn("opacity-0")}
          type="source"
          position={Position.Right}
          isConnectable={false}
        />
      </>
    );
  },
);
