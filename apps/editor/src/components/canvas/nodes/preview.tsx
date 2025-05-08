"use client";

import { useProjectData } from "@/lib/store";
import { Button } from "@weldr/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@weldr/ui/components/dropdown-menu";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import {
  ExternalLinkIcon,
  LoaderIcon,
  MonitorIcon,
  RefreshCwIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

export function Preview({ projectId }: { projectId: string }) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { machineId } = useProjectData();

  const [controlsPosition, setControlsPosition] = useState<
    "top-right" | "bottom-right" | "top-left" | "bottom-left"
  >("top-right");

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
      <div className="relative flex size-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted dark:bg-background">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "absolute size-8 rounded-full bg-foreground transition-all duration-200 hover:bg-foreground/80 dark:bg-background dark:hover:bg-background/80",
                {
                  "top-2 right-2": controlsPosition === "top-right",
                  "right-2 bottom-2": controlsPosition === "bottom-right",
                  "top-2 left-2": controlsPosition === "top-left",
                  "bottom-2 left-2": controlsPosition === "bottom-left",
                },
              )}
            >
              <LogoIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="text-xs">
            <DropdownMenuRadioGroup
              value={isMobile ? "mobile" : "desktop"}
              onValueChange={(value) => {
                setIsMobile(value === "mobile");
              }}
            >
              <DropdownMenuRadioItem value="desktop">
                <MonitorIcon className="mr-2 size-3" />
                Desktop
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="mobile">
                <SmartphoneIcon className="mr-2 size-3" />
                Mobile
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleRefresh}>
              <RefreshCwIcon className="mr-2 size-3" />
              Refresh
            </DropdownMenuItem>
            <a
              href={machineId ? previewUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              <DropdownMenuItem>
                <ExternalLinkIcon className="mr-2 size-3" />
                Open in new tab
              </DropdownMenuItem>
            </a>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Position</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="text-xs">
                <DropdownMenuRadioGroup
                  value={controlsPosition}
                  onValueChange={(value) => {
                    setControlsPosition(
                      value as
                        | "top-right"
                        | "bottom-right"
                        | "top-left"
                        | "bottom-left",
                    );
                  }}
                >
                  <DropdownMenuRadioItem value="top-right">
                    Top Right
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="top-left">
                    Top Left
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="bottom-right">
                    Bottom Right
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="bottom-left">
                    Bottom Left
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {machineId ? (
          <>
            <iframe
              key={iframeKey}
              src={previewUrl}
              className={cn("size-full flex-1 rounded-xl ", {
                hidden: isLoading,
                "mx-auto max-h-[844px] max-w-[375px] border": isMobile,
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
                  "flex size-full flex-1 items-center justify-center rounded-xl bg-background",
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
          <div className="flex size-full flex-1 items-center justify-center rounded-xl bg-background">
            <p className="text-muted-foreground text-sm">
              Your app will appear here!
            </p>
          </div>
        )}
      </div>
    </>
  );
}
