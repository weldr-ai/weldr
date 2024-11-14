"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { api } from "~/lib/trpc/react";

export function CreateWorkspaceForm() {
  const router = useRouter();

  const form = useForm<z.infer<typeof insertWorkspaceSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertWorkspaceSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      description: "",
    },
  });

  const createWorkspaceMutation = api.workspaces.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Workspace created successfully.",
        duration: 2000,
      });
      router.push(`/workspaces/${data.id}`);
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
                <Input placeholder="Enter workspace name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subdomain"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Subdomain</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input placeholder="Enter subdomain" {...field} />
                  <span className="absolute right-2.5 top-[9px] text-xs text-muted-foreground">
                    .integramind.app
                  </span>
                </div>
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
          <Button
            type="submit"
            aria-disabled={
              !form.formState.isValid || createWorkspaceMutation.isPending
            }
            disabled={
              !form.formState.isValid || createWorkspaceMutation.isPending
            }
          >
            {createWorkspaceMutation.isPending && (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            )}
            Create
          </Button>
        </div>
      </form>
    </Form>
  );
}
