"use client";

import type { CanvasNodeProps } from "@/types";
import { Button, buttonVariants } from "@weldr/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@weldr/ui/dialog";
import { cn } from "@weldr/ui/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LoaderIcon,
  MaximizeIcon,
  MonitorIcon,
  RefreshCwIcon,
  SmartphoneIcon,
} from "lucide-react";
import { memo, useEffect, useState } from "react";

export const PreviewNode = memo(({ data }: CanvasNodeProps) => {
  if (data.type !== "preview") {
    return null;
  }

  const { projectId, machineId } = data;
  const [iframeKey, setIframeKey] = useState(0);
  const [currentPath, setCurrentPath] = useState("/");
  const [isMobile, setIsMobile] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const previewUrl = machineId
    ? `https://${machineId}-${projectId}.preview.weldr.app`
    : "";

  // Listen to messages from iframe to track path changes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "navigation" && event.data.path) {
        setCurrentPath(event.data.path);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
    setIsLoading(true);
  };

  const handleBack = () => {
    const iframe = document.querySelector("iframe");
    if (iframe) {
      iframe.contentWindow?.postMessage(
        { type: "navigation", action: "back" },
        "*",
      );
    }
  };

  const handleForward = () => {
    const iframe = document.querySelector("iframe");
    if (iframe) {
      iframe.contentWindow?.postMessage(
        { type: "navigation", action: "forward" },
        "*",
      );
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-muted",
        isMobile ? "h-[844px] w-[390px]" : "h-[800px] w-[1200px]",
      )}
    >
      {machineId ? (
        <>
          <div className="flex h-10 items-center gap-2 rounded-t-lg border-b px-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="size-6"
                title="Go back"
              >
                <ChevronLeftIcon className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleForward}
                className="size-6"
                title="Go forward"
              >
                <ChevronRightIcon className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                className="size-6"
                title="Refresh page"
              >
                <RefreshCwIcon className="size-3" />
              </Button>
            </div>
            <div className="flex flex-1 items-center gap-1 rounded-full bg-accent px-2 py-1">
              <span className="text-xs">{currentPath}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsMobile(!isMobile)}
              className="size-6"
              title={
                isMobile ? "Switch to desktop view" : "Switch to mobile view"
              }
            >
              {isMobile ? (
                <MonitorIcon className="size-3" />
              ) : (
                <SmartphoneIcon className="size-3" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsDialogOpen(true)}
              className="size-6"
              title="Open in dialog"
            >
              <MaximizeIcon className="size-3" />
            </Button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-6",
              )}
              title="Open in new tab"
            >
              <ExternalLinkIcon className="size-3" />
            </a>
          </div>
          <iframe
            key={iframeKey}
            src={previewUrl}
            className={cn("size-full rounded-b-lg", {
              hidden: isLoading,
            })}
            title="Preview"
            sandbox="allow-same-origin allow-scripts allow-forms"
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoading(false)}
          />
          {isLoading && (
            <div className="flex size-full flex-1 items-center justify-center rounded-b-lg bg-accent">
              <div className="flex flex-col items-center gap-2">
                <LoaderIcon className="size-5 animate-spin" />
                <p className="text-sm">Loading preview...</p>
              </div>
            </div>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent
              className={cn(
                "h-[calc(100vh-100px)] max-w-[calc(100vw-100px)] gap-0 border p-0",
                isMobile
                  ? "h-[calc(100vh-100px)] max-w-[390px]"
                  : "h-[calc(100vh-100px)] max-w-[calc(100vw-100px)]",
              )}
              showCloseButton={false}
            >
              <DialogTitle className="sr-only">Preview</DialogTitle>
              <div className="flex h-10 items-center gap-2 rounded-t-lg border-b px-2">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="size-6"
                    title="Go back"
                  >
                    <ChevronLeftIcon className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleForward}
                    className="size-6"
                    title="Go forward"
                  >
                    <ChevronRightIcon className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRefresh}
                    className="size-6"
                    title="Refresh page"
                  >
                    <RefreshCwIcon className="size-3" />
                  </Button>
                </div>
                <div className="flex flex-1 items-center gap-1 rounded-full bg-accent px-2 py-1">
                  <span className="text-xs">{currentPath}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobile(!isMobile)}
                  className="size-6"
                  title={
                    isMobile
                      ? "Switch to desktop view"
                      : "Switch to mobile view"
                  }
                >
                  {isMobile ? (
                    <MonitorIcon className="size-3" />
                  ) : (
                    <SmartphoneIcon className="size-3" />
                  )}
                </Button>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-6",
                  )}
                  title="Open in new tab"
                >
                  <ExternalLinkIcon className="size-3" />
                </a>
              </div>
              <iframe
                src={previewUrl}
                className={cn("h-[calc(100vh-140px)] w-full rounded-b-lg", {
                  hidden: isLoading,
                })}
                title="Preview"
                sandbox="allow-same-origin allow-scripts allow-forms"
                referrerPolicy="no-referrer"
                onLoad={() => setIsLoading(false)}
              />
              {isLoading && (
                <div className="flex size-full flex-1 items-center justify-center rounded-b-lg bg-accent">
                  <div className="flex flex-col items-center gap-2">
                    <LoaderIcon className="size-5 animate-spin" />
                    <p className="text-sm">Loading preview...</p>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex size-full items-center justify-center">
          <p>No version found</p>
        </div>
      )}
    </div>
  );
});
