"use client";

import type { FormState } from "react-hook-form";
import type { z } from "zod";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";

import { insertComponentSchema } from "@integramind/db/schema";
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

import { createComponent } from "~/lib/actions/components";

export function CreateComponentForm({
  setCreateComponentDialogOpen,
}: {
  setCreateComponentDialogOpen?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, createComponentAction] = useFormState(
    createComponent,
    undefined,
  );
  const form = useForm<z.infer<typeof insertComponentSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertComponentSchema),
    defaultValues: {
      name: "",
      description: "",
      workspaceId,
      ...(state &&
        (state.status === "error" || state.status === "validationError") &&
        state.fields),
    },
  });

  useEffect(() => {
    async function handleStateUpdate() {
      if (state) {
        if (state.status === "success") {
          form.reset();
          toast({
            title: "Success",
            description: "Component created successfully.",
            duration: 2000,
          });
          await queryClient.invalidateQueries({
            queryKey: ["components"],
          });
          if (setCreateComponentDialogOpen) {
            setCreateComponentDialogOpen(false);
          }
          router.replace(
            `/workspaces/${workspaceId}/components/${state.payload.id}`,
          );
        } else if (state.status === "validationError") {
          Object.keys(state.errors).forEach((key) => {
            const fieldName = key as "name" | "description";
            form.setError(fieldName, {
              message: state.errors[fieldName],
            });
          });
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
    }
    void handleStateUpdate();
  }, [
    form,
    queryClient,
    router,
    setCreateComponentDialogOpen,
    state,
    workspaceId,
  ]);

  return (
    <Form {...form}>
      <form
        action={createComponentAction}
        className="flex w-full flex-col space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter component name" {...field} />
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
                  placeholder="Enter component description"
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="workspaceId"
          render={({ field }) => <Input {...field} className="hidden" />}
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
  formState: FormState<z.infer<typeof insertComponentSchema>>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={!formState.isValid || pending}
      disabled={!formState.isValid || pending}
    >
      {pending && <Loader2 className="mr-1 size-3 animate-spin" />}
      Create
    </Button>
  );
}
