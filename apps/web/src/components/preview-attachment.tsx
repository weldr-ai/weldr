import { filesize } from "filesize";
import { LoaderIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { shortenFileName } from "@/lib/utils";

import type { Attachment } from "@weldr/shared/types";
import { Button } from "@weldr/ui/components/button";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onDelete,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onDelete?: () => void;
}) => {
  const { name, size, url, contentType } = attachment;

  const formattedSize = filesize(size);

  return (
    <div className="group relative flex h-10 w-[150px] shrink-0 items-center justify-center gap-1 rounded-lg border bg-background py-1 pr-3 pl-1">
      <Button
        variant="outline"
        size="icon"
        className="-right-1.5 -top-1.5 absolute size-4 rounded-full bg-background opacity-0 group-hover:opacity-100"
        onClick={onDelete}
      >
        <XIcon className="size-2.5" />
      </Button>

      {contentType?.startsWith("image") && url && (
        <Image
          key={url}
          src={url}
          alt={name ?? "An image attachment"}
          className="size-8 rounded-sm border object-cover"
          width={40}
          height={40}
        />
      )}

      <div className="grid h-full flex-1 gap-1 text-muted-foreground text-xs leading-none">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap font-medium">
          {shortenFileName(name)}
        </span>
        <span className="line-clamp-1 font-normal">{formattedSize}</span>
      </div>

      {isUploading && (
        <div className="absolute animate-spin bg-background">
          <LoaderIcon className="size-3.5" />
        </div>
      )}
    </div>
  );
};
