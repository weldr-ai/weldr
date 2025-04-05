import { Editor } from "@/components/editor";
import OpenApiEndpointDocs from "@/components/openapi-endpoint-docs";
import { useCanvas } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import type { CanvasNodeProps } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import type { DeclarationSpecsV1 } from "@weldr/shared/types";
import type { functionSchema } from "@weldr/shared/validators/declarations/function";
import { Button } from "@weldr/ui/button";
import { Card } from "@weldr/ui/card";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardTrigger,
} from "@weldr/ui/expandable-card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@weldr/ui/resizable";
import { ScrollArea } from "@weldr/ui/scroll-area";
import { cn } from "@weldr/ui/utils";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { AppWindowIcon, ComponentIcon, FunctionSquareIcon } from "lucide-react";
import type { OpenAPIV3 } from "openapi-types";
import { memo } from "react";
import type { z } from "zod";

export const DeclarationV1Node = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
  }: CanvasNodeProps) => {
    if (_data.type === "preview" || _data.specs?.version !== "v1") {
      return null;
    }

    const { data: declaration } = api.declarations.byId.useQuery(
      {
        id: _data.id,
      },
      {
        initialData: _data,
      },
    );

    const { showEdges } = useCanvas();

    return (
      <>
        <ExpandableCard>
          <ExpandableCardTrigger>
            <DeclarationNodeCard
              declaration={declaration}
              selected={selected}
              positionAbsoluteX={positionAbsoluteX}
              positionAbsoluteY={positionAbsoluteY}
            />
          </ExpandableCardTrigger>
          <ExpandableCardContent className="nowheel -left-[calc(60vw-650px)] flex h-[600px] w-[60vw] flex-col">
            <ResizablePanelGroup
              direction="horizontal"
              className="flex size-full"
            >
              <ResizablePanel
                defaultSize={65}
                minSize={20}
                className="flex flex-col"
              >
                <DeclarationExpandableCardHeader declaration={declaration} />
                <div className="flex h-[calc(100dvh-474px)] flex-col p-4">
                  <ScrollArea className="mb-4 flex-grow">
                    {/* TODO: Add message list */}
                  </ScrollArea>

                  <div className="relative">
                    <Editor
                      className="h-full"
                      id={declaration.id}
                      references={[]}
                      placeholder="Chat about your endpoint..."
                      onChange={() => {}}
                      onSubmit={async () => {}}
                    />
                    <Button
                      type="submit"
                      disabled={false}
                      size="sm"
                      className="absolute right-2 bottom-2 disabled:bg-muted-foreground"
                    >
                      Send
                      <span className="ml-1">
                        <span className="rounded-sm bg-white/20 px-1 py-0.5 disabled:text-muted-foreground">
                          {typeof window !== "undefined" &&
                          window.navigator?.userAgent
                            .toLowerCase()
                            .includes("mac")
                            ? "⌘"
                            : "Ctrl"}
                          ⏎
                        </span>
                      </span>
                    </Button>
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={35} minSize={20}>
                <DeclarationExpandableCardContent declaration={declaration} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          className={cn(
            "rounded-full border bg-background p-1",
            showEdges ? "" : "opacity-0",
          )}
          type="target"
          position={Position.Left}
          isConnectable={false}
        />
        <Handle
          className={cn(
            "rounded-full border bg-background p-1",
            showEdges ? "" : "opacity-0",
          )}
          type="source"
          position={Position.Right}
          isConnectable={false}
        />
      </>
    );
  },
);

const DeclarationExpandableCardHeader = memo(
  ({ declaration }: { declaration: RouterOutputs["declarations"]["byId"] }) => {
    if (!declaration.specs) {
      return null;
    }

    const title = (specs: DeclarationSpecsV1) => {
      if (!specs) {
        return null;
      }

      switch (specs.type) {
        case "endpoint":
          return specs.definition.subtype === "rest"
            ? specs.definition.summary
            : specs.definition.name;
        case "function":
        case "model":
          return specs.name;
        case "component":
          return specs.definition.name;
        default:
          return specs.type.charAt(0).toUpperCase() + specs.type.slice(1);
      }
    };

    switch (declaration.specs.type) {
      case "endpoint":
        return (
          <div className="flex flex-col items-start justify-start gap-2 border-b p-4">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-primary text-xs">
                  {declaration.specs.definition.subtype.toUpperCase()}
                </span>
                <span className="text-muted-foreground">
                  {declaration.specs.type.charAt(0).toUpperCase() +
                    declaration.specs.type.slice(1)}
                </span>
              </div>
            </div>
            <h3
              className={cn("text-sm", {
                "text-destructive": !declaration.specs,
              })}
            >
              {title(declaration.specs)}
            </h3>
          </div>
        );
      default:
        return null;
    }
  },
);

const DeclarationExpandableCardContent = memo(
  ({ declaration }: { declaration: RouterOutputs["declarations"]["byId"] }) => {
    if (!declaration.specs) {
      return null;
    }

    return (
      <ScrollArea className="h-[calc(100dvh-398px)] p-4">
        {declaration.specs.type === "endpoint" ? (
          declaration.specs.definition.subtype === "rest" ? (
            <OpenApiEndpointDocs
              spec={
                declaration.specs.definition
                  ? ({
                      openapi: "3.0.0",
                      info: {
                        title: "Sample API",
                        version: "1.0.0",
                      },
                      paths: {
                        [declaration.specs.definition.path]: {
                          [declaration.specs.definition.method]:
                            declaration.specs.definition,
                        },
                      },
                    } as OpenAPIV3.Document)
                  : null
              }
            />
          ) : (
            <FunctionDetails
              declaration={{
                type: "function",
                name: declaration.specs.definition.name,
                description: declaration.specs.definition.description,
                parameters: declaration.specs.definition.parameters,
                returns: declaration.specs.definition.returns,
                examples: declaration.specs.definition.examples,
                implementationNotes:
                  declaration.specs.definition.implementationNotes,
                remarks: declaration.specs.definition.remarks,
                throws: declaration.specs.definition.throws,
              }}
            />
          )
        ) : declaration.specs.type === "function" ? (
          <FunctionDetails declaration={declaration.specs} />
        ) : null}
      </ScrollArea>
    );
  },
);

const FunctionDetails = ({
  declaration,
}: { declaration: z.infer<typeof functionSchema> }) => {
  return <div>FunctionDetails</div>;
};

const DeclarationNodeCard = memo(
  ({
    declaration,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
  }: {
    declaration: RouterOutputs["declarations"]["byId"];
    selected: boolean | undefined;
    positionAbsoluteX: number;
    positionAbsoluteY: number;
  }) => {
    const { fitBounds } = useReactFlow();

    if (!declaration.specs) {
      return null;
    }

    const title = (specs: DeclarationSpecsV1) => {
      if (!specs) {
        return null;
      }

      switch (specs.type) {
        case "endpoint":
          return specs.definition.subtype === "rest"
            ? specs.definition.summary
            : specs.definition.name;
        case "function":
          return specs.name;
        case "component":
          return specs.definition.name;
        default:
          return null;
      }
    };

    const badge = (specs: DeclarationSpecsV1) => {
      return (
        <div className="flex items-center gap-2 text-xs">
          {specs.type === "endpoint" ? (
            specs.definition.subtype === "rest" ? (
              <>
                <span
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 font-bold text-xs uppercase",
                    {
                      "bg-primary/30 text-primary":
                        specs.definition.method === "get",
                      "bg-success/30 text-success":
                        specs.definition.method === "post",
                      "bg-warning/30 text-warning":
                        specs.definition.method === "put",
                      "bg-destructive/30 text-destructive":
                        specs.definition.method === "delete",
                      "p-0 font-semibold text-primary text-xs":
                        !specs.definition.method,
                    },
                  )}
                >
                  {specs.definition.method.toUpperCase()}
                </span>
                <span className="text-muted-foreground">REST</span>
              </>
            ) : (
              <>
                <FunctionSquareIcon className="size-4" />
                <span className="text-muted-foreground">RPC</span>
              </>
            )
          ) : specs.type === "function" ? (
            <>
              <FunctionSquareIcon className="size-4" />
              <span className="text-muted-foreground">Function</span>
            </>
          ) : specs.type === "component" ? (
            specs.definition.subtype === "page" ? (
              <>
                <AppWindowIcon className="size-4 text-primary" />
                <span className="text-muted-foreground">Page</span>
              </>
            ) : specs.definition.subtype === "reusable" ? (
              <>
                <ComponentIcon className="size-4 text-primary" />
                <span className="text-muted-foreground">Component</span>
              </>
            ) : null
          ) : null}
        </div>
      );
    };

    return (
      <Card
        className={cn(
          "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start justify-center gap-2 px-5 py-4 dark:bg-muted",
          {
            "border-primary": selected,
          },
        )}
        onClick={() => {
          fitBounds(
            {
              x: positionAbsoluteX,
              y: positionAbsoluteY - 100,
              width: 200,
              height: 800,
            },
            {
              duration: 500,
            },
          );
        }}
      >
        <div className="flex w-full items-center justify-between">
          {badge(declaration.specs)}
        </div>
        <span className="w-full truncate text-start text-sm">
          {title(declaration.specs)}
        </span>
      </Card>
    );
  },
);
