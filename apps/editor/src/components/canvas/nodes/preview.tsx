"use client";

import { useProjectView } from "@/lib/store";
import { Button, buttonVariants } from "@weldr/ui/button";
import { cn } from "@weldr/ui/utils";
import {
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
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { machineId } = useProjectView();

  const previewUrl = machineId
    ? `https://${machineId}-${projectId}.preview.weldr.app`
    : "";

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

  return (
    <>
      <div className="relative flex size-full flex-col gap-2 rounded-xl">
        <div className="absolute top-2 right-2 flex items-center rounded-full bg-background p-0.5 opacity-50 transition-all duration-200 hover:opacity-100 hover:shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsMobile(!isMobile)}
            className="size-7 rounded-full"
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
            onClick={handleRefresh}
            className="size-7 rounded-full"
            title="Refresh page"
          >
            <RefreshCwIcon className="size-3" />
          </Button>
          <a
            href={machineId ? previewUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-7 rounded-full",
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
              className={cn("size-full flex-1 rounded-xl", {
                hidden: isLoading,
                "mx-auto max-w-[375px]": isMobile,
              })}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups-to-escape-sandbox allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-presentation"
              allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; clipboard-read; clipboard-write; payment; usb; vr; xr-spatial-tracking; screen-wake-lock; magnetometer; ambient-light-sensor; battery; gamepad; picture-in-picture; display-capture; bluetooth;"
              referrerPolicy="no-referrer"
              loading="eager"
              onLoad={() => setIsLoading(false)}
            />
            {isLoading && (
              <div
                className={cn(
                  "flex size-full flex-1 items-center justify-center rounded-xl border bg-background",
                  {
                    "mx-auto max-w-[375px]": isMobile,
                  },
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <LoaderIcon className="size-5 animate-spin" />
                  <p className="text-sm">Loading preview...</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex size-full flex-1 items-center justify-center rounded-xl border bg-background">
            <p className="text-muted-foreground text-sm">
              Your app will appear here!
            </p>
          </div>
        )}
      </div>
    </>
  );
}
