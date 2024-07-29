"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@integramind/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import { Textarea } from "@integramind/ui/textarea";
import { toast } from "@integramind/ui/use-toast";

import { insertWorkspaceSchema } from "@integramind/shared/validators/workspaces";
import { createWorkspace } from "~/lib/actions/workspaces";

export function CreateWorkspaceForm() {
  const [state, createWorkspaceAction] = useFormState(
    createWorkspace,
    undefined,
  );
  const form = useForm<z.infer<typeof insertWorkspaceSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertWorkspaceSchema),
    defaultValues: {
      name: "",
      description: "",
      ...(state &&
        (state.status === "error" || state.status === "validationError") &&
        state.fields),
    },
  });

  useEffect(() => {
    if (state) {
      if (state.status === "success") {
        form.reset();
        toast({
          title: "Success",
          description: "Workspace created successfully.",
          duration: 2000,
        });
        redirect(`/${state.payload.id}`);
      } else if (state.status === "validationError") {
        for (const key of Object.keys(state.errors)) {
          const fieldName = key as "name" | "description";
          form.setError(fieldName, {
            message: state.errors[fieldName],
          });
        }
        toast({
          title: "Validation Error",
          description: "Please enter fields correctly.",
          variant: "destructive",
          duration: 2000,
        });
      } else {
        toast({
          title: "Error",
          description: "Something went wrong.",
          variant: "destructive",
          duration: 2000,
        });
      }
    }
  }, [form, state]);

  return (
    <Form {...form}>
      <form
        action={createWorkspaceAction}
        className="flex w-full flex-col space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter workspace name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Enter workspace description"
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex w-full justify-end">
          <SubmitButton formState={form.formState} />
        </div>
      </form>
    </Form>
  );
}

function SubmitButton({
  formState,
}: {
  formState: FormState<z.infer<typeof insertWorkspaceSchema>>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={!formState.isValid || pending}
      disabled={!formState.isValid || pending}
    >
      {pending && <Loader2Icon className="mr-1 size-3 animate-spin" />}
      Create
    </Button>
  );
}
