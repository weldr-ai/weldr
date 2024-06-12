import { Loader2Icon } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2">
      <Loader2Icon className="size-8 animate-spin text-primary" />
      <span className="text-sm">Loading...</span>
    </div>
  );
}
