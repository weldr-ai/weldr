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

import type { FlowType } from "@integramind/shared/types";
import { insertFlowSchema } from "@integramind/shared/validators/flows";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import { api } from "~/lib/trpc/client";

export function CreateFlowForm({
  type,
  setCreateFlowDialogOpen,
}: {
  type: FlowType;
  setCreateFlowDialogOpen?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const apiUtils = api.useUtils();

  const createFlowMutation = api.flows.create.useMutation({
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: `${type.charAt(0).toUpperCase()}${type.slice(1)} created successfully.`,
        duration: 2000,
      });
      if (setCreateFlowDialogOpen) {
        setCreateFlowDialogOpen(false);
      }
      await apiUtils.flows.list.invalidate();
      router.push(`/workspaces/${workspaceId}/${data.id}`);
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

  const getInitialValues = (type: FlowType) => {
    const commonInitialValues = {
      name: "",
      workspaceId,
    };

    switch (type) {
      case "utility":
        return {
          ...commonInitialValues,
          type,
        };
      case "endpoint":
        return {
          ...commonInitialValues,
          type,
          metadata: {
            path: "",
          },
        };
      case "workflow":
        return {
          ...commonInitialValues,
          type,
          metadata: {
            recurrence: undefined,
          },
        };
    }
  };

  const form = useForm<z.infer<typeof insertFlowSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertFlowSchema),
    defaultValues: getInitialValues(type),
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
                  placeholder={`Enter ${type} name`}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {type === "endpoint" && (
          <>
            <FormField
              control={form.control}
              name="metadata.path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">URL Path</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="Enter action URL path"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        {type === "workflow" && (
          <FormField
            control={form.control}
            name="metadata.recurrence"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Recurrence</FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="workspaceId"
          render={({ field }) => <Input {...field} className="hidden" />}
        />
        <FormField
          control={form.control}
          name="type"
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
