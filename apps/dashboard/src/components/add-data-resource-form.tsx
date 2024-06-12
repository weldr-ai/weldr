"use client";

import type { FormState } from "react-hook-form";
import type { z } from "zod";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";

import { insertDataResourceSchema } from "@integramind/db/schema";
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

import type { DataResourceProvider } from "~/types";
import { addDataResource } from "~/lib/queries/data-resources";

export function AddDataResourceForm({
  provider,
  setAddResourceDialogOpen,
}: {
  provider: DataResourceProvider;
  setAddResourceDialogOpen?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, addDataResourceAction] = useFormState(
    addDataResource,
    undefined,
  );

  const getMetadataValues = (provider: DataResourceProvider) => {
    switch (provider) {
      case "postgres":
        return {
          connectionString: "",
        };
    }
  };

  const form = useForm<z.infer<typeof insertDataResourceSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertDataResourceSchema),
    defaultValues: {
      name: "",
      description: "",
      provider,
      workspaceId,
      ...getMetadataValues(provider),
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
            description: `${provider.charAt(0).toUpperCase()}${provider.slice(1)} added successfully.`,
            duration: 2000,
          });
          await queryClient.invalidateQueries({ queryKey: ["resources"] });
          if (setAddResourceDialogOpen) {
            setAddResourceDialogOpen(false);
          }
        } else if (state.status === "validationError") {
          Object.keys(state.errors).forEach((key) => {
            form.setError(
              key as
                | "name"
                | "description"
                | "workspaceId"
                | "provider"
                | "connectionString",
              {
                message: state.errors[key],
              },
            );
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
    setAddResourceDialogOpen,
    state,
    provider,
    workspaceId,
  ]);

  return (
    <Form {...form}>
      <form
        action={addDataResourceAction}
        className="flex w-full flex-col space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter resource name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {provider === "postgres" && (
          <FormField
            control={form.control}
            name="connectionString"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Connection string</FormLabel>
                <FormControl>
                  <Input placeholder="Enter connection string" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          name="provider"
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
  formState: FormState<z.infer<typeof insertDataResourceSchema>>;
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
