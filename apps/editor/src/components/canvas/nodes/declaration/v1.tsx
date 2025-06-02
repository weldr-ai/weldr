import { CustomMarkdown } from "@/components/custom-markdown";
import OpenApiEndpointDocs from "@/components/openapi-endpoint-docs";
import { UiTransitionVisualizer } from "@/components/ui-transition-visualizer";
import { useUIStore } from "@/lib/store";
import { useTRPC } from "@/lib/trpc/react";
import type { CanvasNodeProps } from "@/types";
import { useQuery } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import type { DeclarationSpecsV1, JsonSchema } from "@weldr/shared/types";
import type { componentSchema } from "@weldr/shared/validators/declarations/component";
import type { functionSchema } from "@weldr/shared/validators/declarations/function";
import { Card } from "@weldr/ui/components/card";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardTrigger,
} from "@weldr/ui/components/expandable-card";
import { ScrollArea } from "@weldr/ui/components/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import { TreeView, schemaToTreeData } from "@weldr/ui/components/tree-view";
import { cn } from "@weldr/ui/lib/utils";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  AppWindowIcon,
  ComponentIcon,
  FunctionSquareIcon,
  LockIcon,
  LockOpenIcon,
} from "lucide-react";
import type { OpenAPIV3 } from "openapi-types";
import { memo, useState } from "react";
import type { z } from "zod";

export const DeclarationV1Node = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
  }: CanvasNodeProps) => {
    if (_data.specs?.version !== "v1") {
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

    const { showCanvasEdges } = useUIStore();

    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <>
        <ExpandableCard open={isExpanded} onOpenChange={setIsExpanded}>
          <ExpandableCardTrigger>
            <DeclarationNodeCard
              declaration={declaration}
              selected={selected}
              positionAbsoluteX={positionAbsoluteX}
              positionAbsoluteY={positionAbsoluteY}
            />
          </ExpandableCardTrigger>
          <ExpandableCardContent className="nowheel -left-[172px] flex h-[500px] w-[600px] flex-col bg-background dark:bg-muted">
            <DeclarationExpandableCardHeader declaration={declaration} />
            <DeclarationExpandableCardContent declaration={declaration} />
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          className={cn(
            "rounded-full border-[2px] bg-background p-1",
            showCanvasEdges ? "" : "opacity-0",
          )}
          type="target"
          position={Position.Left}
          isConnectable={false}
        />
        <Handle
          className={cn(
            "rounded-full border-[2px] fill-primary p-1 dark:bg-primary",
            showCanvasEdges ? "" : "opacity-0",
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

    const { data } = declaration.specs;

    const title = (data: DeclarationSpecsV1) => {
      if (!data) {
        return null;
      }

      switch (data.type) {
        case "endpoint":
          return data.definition.subtype === "rest"
            ? data.definition.summary
            : data.definition.name;
        case "function":
        case "model":
          return data.name;
        case "component":
          return data.definition.name;
        default:
          return data.type.charAt(0).toUpperCase() + data.type.slice(1);
      }
    };

    switch (data.type) {
      case "endpoint": {
        return (
          <div className="flex flex-col items-start justify-start gap-2 border-b p-4">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-primary text-xs">
                  {data.definition.subtype.toUpperCase()}
                </span>
                <span className="text-muted-foreground">
                  {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
                </span>
              </div>
              <ProtectedBadge protected={data.protected ?? false} />
            </div>
            <h3
              className={cn("text-sm", {
                "text-destructive": !declaration.specs,
              })}
            >
              {title(declaration.specs.data)}
            </h3>
          </div>
        );
      }
      case "function": {
        return (
          <div className="flex flex-col items-start justify-start gap-2 border-b p-4">
            <div className="flex items-center gap-2 text-xs">
              <FunctionSquareIcon className="size-4 text-primary" />
              <span className="text-muted-foreground">Function</span>
            </div>
            <h3 className="text-sm">{data.name}</h3>
          </div>
        );
      }
      case "component": {
        return (
          <div className="flex flex-col items-start justify-start gap-2 border-b p-4">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {data.definition.subtype === "page" ? (
                  <AppWindowIcon className="size-4 text-primary" />
                ) : data.definition.subtype === "reusable" ? (
                  <ComponentIcon className="size-4 text-primary" />
                ) : null}
                <span className="text-muted-foreground">
                  {data.definition.subtype === "page"
                    ? "Page"
                    : data.definition.subtype === "reusable"
                      ? "Component"
                      : null}
                </span>
              </div>
              {data.definition.subtype === "page" && (
                <ProtectedBadge protected={data.protected ?? false} />
              )}
            </div>
            <h3 className="text-sm">{data.definition.name}</h3>
          </div>
        );
      }
      default: {
        return null;
      }
    }
  },
);

const DeclarationExpandableCardContent = memo(
  ({ declaration }: { declaration: RouterOutputs["declarations"]["byId"] }) => {
    if (!declaration.specs) {
      return null;
    }

    const { data } = declaration.specs;

    return (
      <ScrollArea className="max-h-[calc(100svh-578px)] p-4">
        {data.type === "endpoint" ? (
          data.definition.subtype === "rest" ? (
            <OpenApiEndpointDocs
              spec={
                data.definition
                  ? ({
                      openapi: "3.0.0",
                      info: {
                        title: "Sample API",
                        version: "1.0.0",
                      },
                      paths: {
                        [data.definition.path]: {
                          [data.definition.method]: data.definition,
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
                name: data.definition.name,
                description: data.definition.description,
                parameters: data.definition.parameters,
                returns: data.definition.returns,
              }}
            />
          )
        ) : data.type === "function" ? (
          <FunctionDetails declaration={data} />
        ) : data.type === "component" ? (
          <ComponentDetails declaration={data} />
        ) : null}
      </ScrollArea>
    );
  },
);

const ComponentDetails = ({
  declaration,
}: { declaration: z.infer<typeof componentSchema> }) => {
  return (
    <div className="max-h-[500px] space-y-2">
      {declaration.definition.subtype === "page" && (
        <div className="flex flex-col space-y-1">
          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
            Route:
          </span>
          <span className="flex cursor-text select-text items-center gap-2 text-sm">
            {declaration.definition.route}
          </span>
        </div>
      )}
      {declaration.definition.description && (
        <div className="flex flex-col space-y-1">
          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
            Description:
          </span>
          <CustomMarkdown content={declaration.definition.description} />
        </div>
      )}
      {declaration.definition.transitions && (
        <div className="flex flex-col space-y-1">
          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
            Transitions:
          </span>
          <UiTransitionVisualizer
            transitions={declaration.definition.transitions}
          />
        </div>
      )}
    </div>
  );
};

const FunctionDetails = ({
  declaration,
}: { declaration: z.infer<typeof functionSchema> }) => {
  return (
    <div className="max-h-[500px] space-y-2">
      {declaration.description && (
        <div className="flex flex-col space-y-1">
          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
            Description:
          </span>
          <CustomMarkdown content={declaration.description} />
        </div>
      )}
      {declaration.parameters && (
        <div className="flex flex-col space-y-1">
          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
            Parameters:
          </span>
          <TreeView
            data={schemaToTreeData(declaration.parameters as JsonSchema)}
          />
        </div>
      )}
      {declaration.returns && (
        <div className="flex flex-col space-y-1">
          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
            Returns:
          </span>
          <TreeView
            data={schemaToTreeData(declaration.returns as JsonSchema)}
          />
        </div>
      )}
      {declaration.throws && (
        <div className="flex flex-col space-y-1">
          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
            Throws:
          </span>
          <CustomMarkdown
            content={declaration.throws.map((error) => ({
              type: "paragraph",
              value: `- \`${error.type}\`: ${error.description}`,
            }))}
          />
        </div>
      )}
    </div>
  );
};

const DeclarationNodeCard = memo(
  ({
    declaration,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
    className,
  }: {
    declaration: RouterOutputs["declarations"]["byId"];
    selected: boolean | undefined;
    positionAbsoluteX: number;
    positionAbsoluteY: number;
    className?: string;
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
                <FunctionSquareIcon className="size-4 text-primary" />
                <span className="text-muted-foreground">RPC</span>
              </>
            )
          ) : specs.type === "function" ? (
            <>
              <FunctionSquareIcon className="size-4 text-primary" />
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
          className,
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
          {badge(declaration.specs.data)}
        </div>
        <span className="w-full truncate text-start text-sm">
          {title(declaration.specs.data)}
        </span>
      </Card>
    );
  },
);

const ProtectedBadge = ({ protected: isProtected }: { protected: boolean }) => {
  return (
    <Tooltip>
      <TooltipTrigger>
        {isProtected ? (
          <LockIcon className="size-3 text-success" />
        ) : (
          <LockOpenIcon className="size-3 text-destructive" />
        )}
      </TooltipTrigger>
      <TooltipContent className="rounded-sm border bg-muted text-foreground text-xs">
        {isProtected ? "Protected" : "Unprotected"}
      </TooltipContent>
    </Tooltip>
  );
};
