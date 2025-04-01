import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@weldr/ui/alert-dialog";
import { buttonVariants } from "@weldr/ui/button";
import { Input } from "@weldr/ui/input";
import { useState } from "react";

export function DeleteAlertDialog({
  open,
  setOpen,
  onDelete,
  confirmText = "Delete",
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onDelete: () => void;
  confirmText?: string;
}) {
  const [typedText, setTypedText] = useState("");

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText && (
          <div className="flex flex-col gap-2">
            <Input
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={confirmText}
            />
            <p className="text-muted-foreground text-xs">
              Type <span className="font-bold">{confirmText}</span> to confirm
            </p>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={typedText !== confirmText}
            onClick={() => {
              onDelete();
              setTypedText("");
            }}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
