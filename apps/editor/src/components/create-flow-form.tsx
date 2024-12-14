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

import { insertFlowSchema } from "@integramind/shared/validators/flows";
import { api } from "~/lib/trpc/client";

export function CreateFlowForm({
  setCreateFlowDialogOpen,
}: {
  setCreateFlowDialogOpen?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const apiUtils = api.useUtils();

  const createFlowMutation = api.flows.create.useMutation({
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: "Flow created successfully.",
        duration: 2000,
      });
      if (setCreateFlowDialogOpen) {
        setCreateFlowDialogOpen(false);
      }
      await apiUtils.flows.list.invalidate();
      router.push(`/workspaces/${workspaceId}/flows/${data.id}`);
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

  const form = useForm<z.infer<typeof insertFlowSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertFlowSchema),
    defaultValues: {
      name: "",
      workspaceId,
    },
  });

  return (
    <Form {...form}>
      <form className="flex w-full flex-col space-y-4">
        <FormField
          control={form.control}
          name={"name"}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder="Enter flow name"
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
              !form.formState.isValid || createFlowMutation.isPending
            }
            disabled={!form.formState.isValid || createFlowMutation.isPending}
            onClick={async (e) => {
              e.preventDefault();
              await createFlowMutation.mutateAsync(form.getValues());
            }}
          >
            {createFlowMutation.isPending && (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            )}
            Create
          </Button>
        </div>
      </form>
    </Form>
  );
}
