"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@specly/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@specly/ui/form";
import { Input } from "@specly/ui/input";
import { Textarea } from "@specly/ui/textarea";
import { toast } from "@specly/ui/use-toast";

import type { BaseIntegration } from "@specly/shared/types";
import { insertResourceSchema } from "@specly/shared/validators/resources";
import { addResource } from "~/lib/actions/resources";

export function AddResourceForm({
  integration,
  setAddResourceDialogOpen,
}: {
  integration: BaseIntegration;
  setAddResourceDialogOpen?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, addResourceAction] = useFormState(addResource, undefined);

  const form = useForm<z.infer<typeof insertResourceSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertResourceSchema),
    defaultValues: {
      name: "",
      description: undefined,
      workspaceId,
    },
  });

  useEffect(() => {
    async function handleStateUpdate() {
      if (state) {
        if (state.status === "success") {
          form.reset();
          toast({
            title: "Success",
            description: "Resource added successfully.",
            duration: 2000,
          });
          await queryClient.invalidateQueries({ queryKey: ["resources"] });
          if (setAddResourceDialogOpen) {
            setAddResourceDialogOpen(false);
          }
        } else if (state.status === "validationError") {
          for (const key of Object.keys(state.errors)) {
            form.setError(key as keyof typeof form.formState.errors, {
              message: state.errors[key],
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
            description: `${state.message ? state.message : "Something went wrong."}`,
            variant: "destructive",
            duration: 2000,
          });
        }
      }
    }
    void handleStateUpdate();
  }, [form, queryClient, setAddResourceDialogOpen, state]);

  return (
    <Form {...form}>
      <form
        action={addResourceAction}
        className="flex w-full flex-col space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  placeholder="Enter resource name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {integration.type === "postgres" && (
          <div className="flex flex-col gap-2" />
        )}
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
                  placeholder="Enter resource description"
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
        <FormField
          control={form.control}
          name="integrationId"
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
  formState: FormState<z.infer<typeof insertResourceSchema>>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={!formState.isValid || pending}
      disabled={!formState.isValid || pending}
    >
      {pending && <Loader2Icon className="mr-1 size-3 animate-spin" />}
      Add
    </Button>
  );
}
