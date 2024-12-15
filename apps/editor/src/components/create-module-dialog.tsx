"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@integramind/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@integramind/ui/dialog";

import { CreateModuleForm } from "~/components/create-module-form";

export function CreateModuleDialog({ size = "sm" }: { size?: "sm" | "icon" }) {
  const [createModuleDialogOpen, setCreateModuleDialogOpen] = useState(false);

  return (
    <Dialog
      open={createModuleDialogOpen}
      onOpenChange={setCreateModuleDialogOpen}
    >
      <DialogTrigger asChild>
        {size === "sm" ? (
          <Button variant="outline" className="text-xs">
            <PlusIcon className="mr-1.5 size-3.5" />
            Create new module
          </Button>
        ) : (
          <Button variant="outline" className="size-7 p-0">
            <PlusIcon className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new module</DialogTitle>
          <DialogDescription>
            Enter the module details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateModuleForm
          setCreateModuleDialogOpen={setCreateModuleDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
