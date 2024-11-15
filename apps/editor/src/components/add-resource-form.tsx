"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
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

import type { Integration } from "@integramind/shared/types";
import { insertResourceSchema } from "@integramind/shared/validators/resources";
import { api } from "~/lib/trpc/react";

export function AddResourceForm({
  integration,
  setAddResourceDialogOpen,
}: {
  integration: Omit<Integration, "dependencies">;
  setAddResourceDialogOpen?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const form = useForm<z.infer<typeof insertResourceSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertResourceSchema),
    defaultValues: {
      name: "",
      description: undefined,
      workspaceId,
      integrationId: integration.id,
      environmentVariables: {},
    },
  });

  const addResourceMutation = api.resources.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Resource created successfully.",
        duration: 2000,
      });
      router.refresh();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  return (
    <Form {...form}>
      <form className="flex w-full flex-col space-y-4">
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
          <>
            <FormField
              control={form.control}
              name="environmentVariables.POSTGRES_USER"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Database User</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder="Enter database user"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="environmentVariables.POSTGRES_PASSWORD"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Database Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      type="password"
                      placeholder="Enter database password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="environmentVariables.POSTGRES_HOST"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Database Host</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder="Enter database host"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="environmentVariables.POSTGRES_PORT"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Database Port</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder="Enter database port"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="environmentVariables.POSTGRES_DB"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Database Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder="Enter database name"
                    />
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
          name="integrationId"
          render={({ field }) => <Input {...field} className="hidden" />}
        />
        <div className="flex w-full justify-end">
          <Button
            type="submit"
            aria-disabled={
              !form.formState.isValid || addResourceMutation.isPending
            }
            disabled={!form.formState.isValid || addResourceMutation.isPending}
          >
            {addResourceMutation.isPending && (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            )}
            Add
          </Button>
        </div>
      </form>
    </Form>
  );
}
