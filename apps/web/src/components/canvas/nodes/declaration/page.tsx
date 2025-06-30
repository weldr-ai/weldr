import { useTRPC } from "@/lib/trpc/react";
import type { CanvasNodeProps } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@weldr/ui/components/badge";
import { Button } from "@weldr/ui/components/button";
import { Card, CardContent } from "@weldr/ui/components/card";
import { Input } from "@weldr/ui/components/input";
import { Label } from "@weldr/ui/components/label";
import { cn } from "@weldr/ui/lib/utils";
import { Handle, Position } from "@xyflow/react";
import {
  CircleIcon,
  ExpandIcon,
  HammerIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { BrowserPreviewDialog } from "../components/browser-preview-dialog";
import { ProtectedBadge } from "../components/protected-badge";

export const PageNode = memo(({ data: _data, selected }: CanvasNodeProps) => {
  // Only handle page declarations
  if (_data.specs?.data.type !== "page") {
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

  const [parameterValues, setParameterValues] = useState<
    Record<string, string>
  >({});
  const [showPreview, setShowPreview] = useState(false);
  const [browserDialogOpen, setBrowserDialogOpen] = useState(false);

  if (!declaration.specs || declaration.specs.data.type !== "page") {
    return null;
  }

  const pageData = declaration.specs.data;

  // Extract parameters from route (e.g., /users/{id} -> ["id"])
  const routeParameters = (() => {
    return (
      pageData.parameters
        ?.filter((param) => param.in === "path")
        .map((param) => param.name) ?? []
    );
  })();

  const hasParameters = routeParameters.length > 0;

  // Build preview URL with parameters
  const previewUrl = useMemo(() => {
    if (!hasParameters) {
      return `https://example.com${pageData.route}`;
    }

    let url = pageData.route;
    for (const param of routeParameters) {
      if (parameterValues[param]) {
        url = url.replace(`{${param}}`, parameterValues[param]);
      }
    }
    return `https://example.com${url}`;
  }, [pageData.route, routeParameters, parameterValues]);

  const canShowPreview =
    !hasParameters || routeParameters.every((param) => parameterValues[param]);

  const handleParameterChange = (param: string, value: string) => {
    setParameterValues((prev) => ({ ...prev, [param]: value }));
  };

  const handlePreviewClick = () => {
    setShowPreview(true);
  };

  const handleExpandClick = () => {
    setBrowserDialogOpen(true);
  };

  // Resolve route with parameter values and return colorized JSX
  const getResolvedRoute = useMemo(() => {
    const hasParameters = routeParameters.length > 0;

    if (!hasParameters) {
      return pageData.route;
    }

    let resolvedRoute = pageData.route;
    for (const param of routeParameters) {
      if (parameterValues[param]) {
        resolvedRoute = resolvedRoute.replace(
          `{${param}}`,
          parameterValues[param],
        );
      }
    }

    // Colorize the resolved route
    return resolvedRoute.split(/(\{[^}]+\})/).map((part) => (
      <span
        key={part || `path-segment-${Math.random()}`}
        className={cn(
          part.startsWith("{") && part.endsWith("}") ? "text-warning" : "",
        )}
      >
        {part}
      </span>
    ));
  }, [pageData.route, routeParameters, parameterValues]);

  const colorizedRoute = useMemo(() => {
    return pageData.route.split(/(\{[^}]+\})/).map((part) => (
      <span
        key={part || `path-segment-${Math.random()}`}
        className={cn(
          part.startsWith("{") && part.endsWith("}") ? "text-warning" : "",
        )}
      >
        {part}
      </span>
    ));
  }, [pageData.route]);

  // Handle in_progress state
  if (declaration.progress !== "completed") {
    return (
      <>
        <Card
          className={cn(
            "nowheel drag-handle group relative origin-center cursor-pointer rounded-lg p-0 transition-all duration-300 ease-in-out dark:bg-muted",
            {
              "border-primary": selected,
              "h-[300px] w-[400px]": true,
            },
          )}
        >
          {/* Floating Header - Appears on Hover */}
          <div className="-top-10 absolute right-0 left-0 z-20 flex items-center justify-between gap-2 rounded-md border bg-muted px-2 py-1 opacity-0 transition-all duration-200 group-hover:opacity-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary text-xs">PAGE</span>
              <span className="font-medium text-sm">{pageData.name}</span>
            </div>
            <ProtectedBadge protected={pageData.protected ?? false} />
          </div>

          <CardContent className="flex size-full flex-col items-center justify-center space-y-6">
            <div className="animate-pulse space-y-2">
              {declaration.progress === "pending" && (
                <>
                  <CircleIcon className="mx-auto size-8 fill-warning text-warning" />
                  <h3 className="font-semibold text-lg">Pending</h3>
                </>
              )}
              {declaration.progress === "in_progress" && (
                <>
                  <HammerIcon className="mx-auto size-8 text-primary" />
                  <h3 className="font-semibold text-lg">Building</h3>
                </>
              )}
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className="text-sm">
                <span className="text-muted-foreground">Page:</span>{" "}
                {pageData.name}
              </span>
              <span className="text-sm">
                <span className="text-muted-foreground">Route:</span>{" "}
                {colorizedRoute}
              </span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {pageData.protected ? (
                <ShieldCheckIcon className="size-3 text-success" />
              ) : (
                <ShieldXIcon className="size-3 text-destructive" />
              )}
              {pageData.protected ? "Protected" : "Public"}
            </Badge>
          </CardContent>
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
  }

  // Handle parameter input state (for completed declarations with parameters)
  if (hasParameters && (!showPreview || !canShowPreview)) {
    return (
      <>
        <Card
          className={cn(
            "nowheel drag-handle group relative origin-center cursor-pointer rounded-lg p-0 transition-all duration-300 ease-in-out dark:bg-muted",
            {
              "border-primary": selected,
              "h-[300px] w-[400px]": true,
            },
          )}
        >
          {/* Floating Header - Appears on Hover */}
          <div className="-top-10 absolute right-0 left-0 z-20 flex items-center justify-between gap-2 rounded-md border bg-muted px-2 py-1 opacity-0 transition-all duration-200 group-hover:opacity-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary text-xs">PAGE</span>
              <span className="font-medium text-sm">
                {pageData.name}{" "}
                <span className="text-muted-foreground text-xs">
                  Parameters Required
                </span>
              </span>
            </div>
            <ProtectedBadge protected={pageData.protected ?? false} />
          </div>

          {/* Parameter Input Form */}
          <div className="flex h-full w-full flex-col items-center justify-center space-y-4 p-6">
            <div className="space-y-2 text-center">
              <SettingsIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Parameters Required</h3>
              <p className="text-muted-foreground text-sm">
                Enter parameter values to preview this page
              </p>
            </div>

            <div className="w-full max-w-sm space-y-2">
              {routeParameters.map((param) => (
                <div key={param} className="space-y-2">
                  <Label>{param}</Label>
                  <Input
                    id={`param-${param}`}
                    placeholder={`Enter ${param}...`}
                    value={parameterValues[param] || ""}
                    onChange={(e) =>
                      handleParameterChange(param, e.target.value)
                    }
                    className="h-8 w-full"
                  />
                </div>
              ))}
              <Button
                onClick={handlePreviewClick}
                disabled={!canShowPreview}
                className="w-full"
                size="sm"
              >
                Preview
              </Button>
            </div>
            <div className="text-muted-foreground text-sm">
              Route: {colorizedRoute}
            </div>
          </div>
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
  }

  // Handle completed state with preview (default case)
  return (
    <>
      <div
        className={cn(
          "nowheel drag-handle group relative origin-center rounded-lg transition-all duration-300 ease-in-out",
          {
            "border-primary": selected,
          },
        )}
      >
        {/* Floating Header - Appears on Hover */}
        <div className="-top-10 absolute right-0 left-0 z-20 flex items-center justify-between gap-2 rounded-md border bg-muted px-2 py-1 opacity-0 transition-all duration-200 group-hover:opacity-100">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary text-xs">PAGE</span>
            <span className="font-medium text-sm">{pageData.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleExpandClick}
            >
              <ExpandIcon className="size-3" />
            </Button>
            <ProtectedBadge protected={pageData.protected ?? false} />
          </div>
        </div>

        {/* Main Desktop-Sized Iframe */}
        <div className="relative h-[300px] w-[400px] overflow-hidden rounded-lg shadow-lg">
          <iframe
            src={previewUrl}
            className="absolute top-0 left-0 h-[600px] w-[800px] origin-top-left scale-[0.5] rounded-lg border-0"
            title={pageData.name}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            loading="lazy"
          />

          {/* Route Badge - Bottom Corner */}
          <div className="absolute bottom-4 left-4 opacity-0 transition-opacity group-hover:opacity-100">
            <Badge variant="secondary" className="font-mono text-xs">
              {getResolvedRoute}
            </Badge>
          </div>
        </div>
      </div>

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

      <BrowserPreviewDialog
        open={browserDialogOpen}
        onOpenChange={setBrowserDialogOpen}
        title={pageData.name}
        url={previewUrl}
        isProtected={pageData.protected ?? false}
      />
    </>
  );
});
