"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { insertResourceSchema } from "@integramind/db/schema";
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

import { addResource } from "~/lib/queries/resources";
import type { ResourceProvider } from "~/types";

export function AddResourceForm({
  provider,
  setAddResourceDialogOpen,
}: {
  provider: ResourceProvider;
  setAddResourceDialogOpen?: (open: boolean) => void;
}) {
  // FIXME: use suspense with revalidateTag
  const queryClient = useQueryClient();
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, addResourceAction] = useFormState(addResource, undefined);

  const getMetadataValues = (provider: ResourceProvider) => {
    switch (provider) {
      case "postgres":
        return {
          host: "",
          port: 5432,
          user: "",
          password: "",
          database: "",
        };
    }
  };

  const form = useForm<z.infer<typeof insertResourceSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertResourceSchema),
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
          for (const key of Object.keys(state.errors)) {
            form.setError(
              key as
                | "name"
                | "description"
                | "workspaceId"
                | "provider"
                | "host"
                | "port"
                | "user"
                | "password"
                | "database",
              {
                message: state.errors[key],
              },
            );
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
    }
    void handleStateUpdate();
  }, [form, queryClient, setAddResourceDialogOpen, state, provider]);

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
                <Input placeholder="Enter resource name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {provider === "postgres" && (
          <>
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Host</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter host" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Port</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter port" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="user"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">User</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter user" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Password</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="database"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Database</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter database" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
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
