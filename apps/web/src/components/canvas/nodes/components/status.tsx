import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import { CircleIcon, HammerIcon } from "lucide-react";

export const Status = ({
  progress,
}: {
  progress: "pending" | "in_progress";
}) => {
  return (
    <Tooltip>
      <TooltipTrigger className="animate-pulse space-y-2">
        {progress === "pending" && (
          <CircleIcon className="size-3 animate-pulse fill-warning text-warning" />
        )}
        {progress === "in_progress" && (
          <HammerIcon className="size-3 animate-pulse fill-warning text-warning" />
        )}
      </TooltipTrigger>
      <TooltipContent className="border bg-muted">
        {progress === "pending" && "Pending"}
        {progress === "in_progress" && "Building"}
      </TooltipContent>
    </Tooltip>
  );
};
