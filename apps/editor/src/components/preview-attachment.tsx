import type { Attachment } from "@weldr/shared/types";
import { Button } from "@weldr/ui/button";
import { LoaderIcon, XIcon } from "lucide-react";
import Image from "next/image";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onDelete,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onDelete?: () => void;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div className="group relative flex size-10 items-center justify-center rounded-md bg-background">
      <Button
        variant="outline"
        className="-right-1.5 -top-1.5 absolute h-fit rounded-full bg-background p-0.5 opacity-0 group-hover:opacity-100"
        onClick={onDelete}
      >
        <XIcon className="size-2.5" />
      </Button>

      {contentType?.startsWith("image") && url && (
        <Image
          key={url}
          src={url}
          alt={name ?? "An image attachment"}
          className="size-10 rounded-md object-cover"
          width={40}
          height={40}
        />
      )}

      {isUploading && (
        <div className="absolute animate-spin bg-muted">
          <LoaderIcon className="size-3.5" />
        </div>
      )}
    </div>
  );
};
