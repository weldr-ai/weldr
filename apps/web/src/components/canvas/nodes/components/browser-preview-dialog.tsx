"use client";

import { Badge } from "@weldr/ui/components/badge";
import { Button, buttonVariants } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@weldr/ui/components/dialog";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@weldr/ui/components/toggle-group";
import { cn } from "@weldr/ui/lib/utils";
import {
  ExternalLinkIcon,
  LoaderIcon,
  MonitorIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useState } from "react";

interface BrowserPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
  isProtected?: boolean;
}

export function BrowserPreviewDialog({
  open,
  onOpenChange,
  title,
  url,
  isProtected = false,
}: BrowserPreviewDialogProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
    setIsLoading(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex min-h-[calc(100vh-50px)] min-w-[calc(100vw-50px)] flex-col gap-0 p-0"
        withCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b py-1.5 pr-1.5 pl-3">
          <DialogTitle className="flex items-center gap-2">
            <span>{title}</span>
            <Badge variant="secondary" className="flex items-center gap-1">
              {isProtected ? (
                <ShieldCheckIcon className="text-success" />
              ) : (
                <ShieldXIcon className="text-destructive" />
              )}
              {isProtected ? "Protected" : "Unprotected"}
            </Badge>
          </DialogTitle>
          <div className="flex items-center gap-1">
            <div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({
                    variant: "ghost",
                    size: "icon",
                  }),
                  "size-7",
                )}
              >
                <ExternalLinkIcon className="size-3.5" />
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleRefresh}
              >
                <RefreshCwIcon className="size-3.5" />
              </Button>
            </div>
            <ToggleGroup
              type="single"
              className="border"
              value={isMobile ? "mobile" : "desktop"}
              onValueChange={(value) => setIsMobile(value === "mobile")}
            >
              <ToggleGroupItem value="desktop" className="size-7">
                <MonitorIcon className="size-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="mobile" className="size-7">
                <SmartphoneIcon className="size-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </DialogHeader>
        <iframe
          key={iframeKey}
          src={url}
          className={cn("size-full flex-1 rounded-b-lg", {
            hidden: isLoading,
            "mx-auto max-w-[375px] rounded-b-none": isMobile,
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
              "flex size-full flex-1 items-center justify-center bg-background",
              {
                "mx-auto max-w-[375px]": isMobile,
              },
            )}
          >
            <div className="flex flex-col items-center gap-2">
              <LoaderIcon className="size-5 animate-spin" />
              <p className="text-sm">Loading...</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
