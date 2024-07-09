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

import { insertFlowSchema } from "@integramind/db/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import { Textarea } from "@integramind/ui/textarea";
import { toast } from "@integramind/ui/use-toast";

import type { FlowType } from "~/types";
import { createFlow } from "~/lib/queries/flows";

export function CreateFlowForm({
  type,
  setCreatePrimitiveDialogOpen,
}: {
  type: FlowType;
  setCreatePrimitiveDialogOpen?: (open: boolean) => void;
}) {
  // FIXME: use suspense with revalidateTag
  const queryClient = useQueryClient();
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, createFlowAction] = useFormState(createFlow, undefined);

  const getMetadataValues = (type: FlowType) => {
    switch (type) {
      case "component":
        return {
          workspaceId,
        };
      case "route":
        return {
          actionType: undefined,
          urlPath: "",
        };
      case "workflow":
        return {
          triggerType: undefined,
        };
    }
  };

  const form = useForm<z.infer<typeof insertFlowSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertFlowSchema),
    defaultValues: {
      name: "",
      description: "",
      type,
      workspaceId,
      ...getMetadataValues(type),
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
            description: `${type.charAt(0).toUpperCase()}${type.slice(1)} created successfully.`,
            duration: 2000,
          });
          await queryClient.invalidateQueries({ queryKey: [`${type}s`] });
          if (setCreatePrimitiveDialogOpen) {
            setCreatePrimitiveDialogOpen(false);
          }
          router.replace(
            `/workspaces/${workspaceId}/${type}s/${state.payload.id}`,
          );
        } else if (state.status === "validationError") {
          Object.keys(state.errors).forEach((key) => {
            form.setError(
              key as
                | "name"
                | "description"
                | "workspaceId"
                | "type"
                | "actionType"
                | "urlPath"
                | "triggerType",
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
    setCreatePrimitiveDialogOpen,
    state,
    type,
    workspaceId,
  ]);

  return (
    <Form {...form}>
      <form
        action={createFlowAction}
        className="flex w-full flex-col space-y-4"
      >
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
        {type === "workflow" && (
          <FormField
            control={form.control}
            name="triggerType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Type</FormLabel>
                <FormControl>
                  <Select
                    name={field.name}
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Trigger Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {type === "route" && (
          <>
            <FormField
              control={form.control}
              name="actionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Type</FormLabel>
                  <FormControl>
                    <Select
                      name={field.name}
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Action Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="urlPath"
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
                  placeholder="Enter workflow description"
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
          name="type"
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
  formState: FormState<z.infer<typeof insertFlowSchema>>;
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
