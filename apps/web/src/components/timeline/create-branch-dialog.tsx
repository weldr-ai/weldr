"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { Button } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@weldr/ui/components/dialog";
import { toast } from "@weldr/ui/hooks/use-toast";

import { useTRPC } from "@/lib/trpc/react";

interface CreateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  versionId: string;
  versionNumber: number;
  branchType: "variant" | "stream";
}

export function CreateBranchDialog({
  open,
  onOpenChange,
  projectId,
  versionId,
  versionNumber,
  branchType,
}: CreateBranchDialogProps) {
  const router = useRouter();
  const trpc = useTRPC();

  const generatedName = useMemo(() => {
    const randomName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: "-",
      length: 3,
      style: "lowerCase",
    });
    return `${branchType}/${randomName}`;
  }, [branchType]);

  const createBranch = useMutation(
    trpc.branches.create.mutationOptions({
      onSuccess: (branch) => {
        onOpenChange(false);
        // Navigate to the new branch
        router.push(`/projects/${projectId}/branches/${branch.id}`);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
          duration: 2000,
        });
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            Create {branchType === "variant" ? "Variant" : "Stream"}
          </DialogTitle>
          <DialogDescription>
            Create a new branch from version #{versionNumber}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 rounded-lg border bg-muted/50 p-3">
          <p className="text-muted-foreground text-xs">Temporary name</p>
          <code className="block rounded bg-background px-2 py-1.5 font-mono text-sm">
            {generatedName}
          </code>
          <p className="text-muted-foreground text-xs">
            AI will suggest a better name when you start.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={createBranch.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() =>
              createBranch.mutate({
                projectId,
                name: generatedName,
                type: branchType,
                forkedFromVersionId: versionId,
              })
            }
            disabled={createBranch.isPending}
          >
            {createBranch.isPending && (
              <Loader2Icon className="size-4 animate-spin" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
