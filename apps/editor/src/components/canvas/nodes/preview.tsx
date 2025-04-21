"use client";

import { useProjectView } from "@/lib/store";
import { Button, buttonVariants } from "@weldr/ui/button";
import { cn } from "@weldr/ui/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LoaderIcon,
  MonitorIcon,
  RefreshCwIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

export function Preview({
  projectId,
}: {
  projectId: string;
}) {
  const [iframeKey, setIframeKey] = useState(0);
  const [currentPath, setCurrentPath] = useState("/");
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { machineId } = useProjectView();

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

  useEffect(() => {
    if (machineId) {
      setIframeKey((prev) => prev + 1);
      setIsLoading(true);
    }
  }, [machineId]);

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
    <>
      <div className="flex size-full flex-col rounded-tl-xl bg-background">
        <div className="flex h-[39px] items-center gap-2 rounded-t-xl border-b bg-muted px-2">
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
          <a
            href={machineId ? previewUrl : undefined}
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
        {machineId ? (
          <>
            <iframe
              key={iframeKey}
              src={previewUrl}
              className={cn("size-full flex-1", {
                hidden: isLoading,
                "mx-auto max-w-[375px]": isMobile,
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
          </>
        ) : (
          <div className="flex size-full flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              Your app will appear here!
            </p>
          </div>
        )}
      </div>
    </>
  );
}
