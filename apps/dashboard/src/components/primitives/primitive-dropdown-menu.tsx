import { Button } from "@specly/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@specly/ui/dropdown-menu";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";

export function PrimitiveDropdownMenu({
  setDeleteAlertDialogOpen,
  label,
  docsUrlPath,
}: {
  setDeleteAlertDialogOpen: (open: boolean) => void;
  label: string;
  docsUrlPath: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="size-7 text-muted-foreground hover:text-muted-foreground"
          variant="ghost"
          size="icon"
        >
          <EllipsisVerticalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs">
          <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
          Run with previous primitives
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center justify-between text-xs">
          <Link
            className="flex items-center"
            href={`https://docs.specly.ai/primitives/${docsUrlPath}`}
            target="blank"
          >
            <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
            Docs
          </Link>
          <ExternalLinkIcon className="size-3 text-muted-foreground" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex text-xs text-destructive hover:text-destructive focus:text-destructive/90"
          onClick={() => setDeleteAlertDialogOpen(true)}
        >
          <TrashIcon className="mr-3 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
