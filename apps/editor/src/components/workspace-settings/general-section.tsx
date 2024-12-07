import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@integramind/api";
import { updateWorkspaceSchema } from "@integramind/shared/validators/workspaces";
import { Button } from "@integramind/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@integramind/ui/card";
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
import { Loader2Icon } from "lucide-react";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { api } from "~/lib/trpc/client";

export function GeneralSection({
  workspace,
}: { workspace: RouterOutputs["workspaces"]["byId"] }) {
  const router = useRouter();
  const apiUtils = api.useUtils();

  const updateWorkspace = api.workspaces.update.useMutation({
    onSuccess: () => {
      apiUtils.workspaces.byId.invalidate();
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

  const form = useForm<z.infer<typeof updateWorkspaceSchema>>({
    mode: "onChange",
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: {
      where: {
        id: workspace.id,
      },
      payload: {
        name: workspace.name,
        description: workspace.description ?? "",
        subdomain: workspace.subdomain,
      },
    },
  });

  async function onSubmit(data: z.infer<typeof updateWorkspaceSchema>) {
    const result = await updateWorkspace.mutateAsync(data);
    form.reset({
      where: {
        id: result.id,
      },
      payload: {
        name: result.name,
        description: result.description ?? "",
        subdomain: result.subdomain,
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>
          Manage your workspace general settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="payload.name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payload.subdomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subdomain</FormLabel>
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
              name="payload.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Enter description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={
                  updateWorkspace.isPending ||
                  !form.formState.isValid ||
                  !form.formState.isDirty
                }
              >
                {updateWorkspace.isPending && (
                  <Loader2Icon className="size-3.5 mr-2 animate-spin" />
                )}
                Update
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
