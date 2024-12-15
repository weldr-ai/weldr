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
import { toast } from "@integramind/ui/use-toast";

import { insertModuleSchema } from "@integramind/shared/validators/modules";
import { Textarea } from "@integramind/ui/textarea";
import { api } from "~/lib/trpc/client";

export function CreateModuleForm({
  setCreateModuleDialogOpen,
}: {
  setCreateModuleDialogOpen?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const apiUtils = api.useUtils();

  const createModuleMutation = api.modules.create.useMutation({
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: "Module created successfully.",
        duration: 2000,
      });
      if (setCreateModuleDialogOpen) {
        setCreateModuleDialogOpen(false);
      }
      await apiUtils.modules.list.invalidate();
      router.push(`/workspaces/${workspaceId}/modules/${data.id}`);
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

  const form = useForm<z.infer<typeof insertModuleSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertModuleSchema),
    defaultValues: {
      name: "",
      description: "",
      workspaceId,
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
                  autoComplete="off"
                  placeholder="Enter module name"
                  {...field}
                />
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
              <FormLabel className="text-xs">Description</FormLabel>
              <FormControl>
                <Textarea
                  autoComplete="off"
                  placeholder="Enter module description"
                  {...field}
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
          <Button
            type="button"
            aria-disabled={
              !form.formState.isValid || createModuleMutation.isPending
            }
            disabled={!form.formState.isValid || createModuleMutation.isPending}
            onClick={async (e) => {
              e.preventDefault();
              await createModuleMutation.mutateAsync(form.getValues());
            }}
          >
            {createModuleMutation.isPending && (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            )}
            Create
          </Button>
        </div>
      </form>
    </Form>
  );
}
