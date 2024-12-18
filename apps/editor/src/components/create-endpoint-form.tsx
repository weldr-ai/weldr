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

import { insertEndpointSchema } from "@integramind/shared/validators/endpoints";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import { Textarea } from "@integramind/ui/textarea";
import { api } from "~/lib/trpc/client";

export function CreateEndpointForm({
  setCreateEndpointDialogOpen,
}: {
  setCreateEndpointDialogOpen?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();

  const apiUtils = api.useUtils();

  const createEndpointMutation = api.endpoints.create.useMutation({
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: "Endpoint created successfully.",
        duration: 2000,
      });
      if (setCreateEndpointDialogOpen) {
        setCreateEndpointDialogOpen(false);
      }
      await apiUtils.endpoints.list.invalidate();
      router.push(`/projects/${projectId}/endpoints/${data.id}`);
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

  const form = useForm<z.infer<typeof insertEndpointSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertEndpointSchema),
    defaultValues: {
      name: "",
      description: "",
      httpMethod: "get",
      path: "/",
      projectId,
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
                  placeholder="Enter endpoint name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-[2fr,1fr] gap-4">
          <FormField
            control={form.control}
            name="path"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Path</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder="/customers/{id}"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="httpMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">HTTP Method</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select HTTP method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="get">GET</SelectItem>
                    <SelectItem value="post">POST</SelectItem>
                    <SelectItem value="put">PUT</SelectItem>
                    <SelectItem value="delete">DELETE</SelectItem>
                    <SelectItem value="patch">PATCH</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Description</FormLabel>
              <FormControl>
                <Textarea
                  autoComplete="off"
                  placeholder="Enter endpoint description"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex w-full justify-end">
          <Button
            type="button"
            aria-disabled={
              !form.formState.isValid || createEndpointMutation.isPending
            }
            disabled={
              !form.formState.isValid || createEndpointMutation.isPending
            }
            onClick={async (e) => {
              e.preventDefault();
              await createEndpointMutation.mutateAsync(form.getValues());
            }}
          >
            {createEndpointMutation.isPending && (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            )}
            Create
          </Button>
        </div>
      </form>
    </Form>
  );
}
