import { getProjectDownloadUrl } from "@/lib/actions/get-project-download-url";
import { TooltipContent, TooltipTrigger } from "@weldr/ui/tooltip";

import { Button } from "@weldr/ui/button";
import { Tooltip } from "@weldr/ui/tooltip";
import { DownloadIcon, LoaderIcon } from "lucide-react";
import { useState } from "react";

export function DownloadButton({ projectId }: { projectId: string }) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isLoading}
          onClick={async () => {
            setIsLoading(true);
            const url = await getProjectDownloadUrl({
              projectId,
            });
            window.open(url, "_blank");
            setIsLoading(false);
          }}
        >
          {isLoading ? (
            <LoaderIcon className="size-4 animate-spin" />
          ) : (
            <DownloadIcon className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="border bg-muted">
        Download Project
      </TooltipContent>
    </Tooltip>
  );
}
