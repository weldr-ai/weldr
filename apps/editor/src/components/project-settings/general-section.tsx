import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@integramind/api";
import { updateProjectSchema } from "@integramind/shared/validators/projects";
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
import { toast } from "@integramind/ui/hooks/use-toast";
import { Input } from "@integramind/ui/input";
import { Textarea } from "@integramind/ui/textarea";
import { Loader2Icon } from "lucide-react";

import { api } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export function GeneralSection({
  project,
}: { project: RouterOutputs["projects"]["byId"] }) {
  const router = useRouter();

  const updateProject = api.projects.update.useMutation({
    onSuccess: () => {
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

  const form = useForm<z.infer<typeof updateProjectSchema>>({
    mode: "onChange",
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      where: {
        id: project.id,
      },
      payload: {
        name: project.name,
        description: project.description ?? "",
        subdomain: project.subdomain,
      },
    },
  });

  async function onSubmit(data: z.infer<typeof updateProjectSchema>) {
    const result = await updateProject.mutateAsync(data);
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
        <CardDescription>Manage your project general settings</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="payload.name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
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
                      <span className="absolute top-[9px] right-2.5 text-muted-foreground text-xs">
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
                  updateProject.isPending ||
                  !form.formState.isValid ||
                  !form.formState.isDirty
                }
              >
                {updateProject.isPending && (
                  <Loader2Icon className="mr-2 size-3.5 animate-spin" />
                )}
                Update
              </Button>
            </div>
          </form>
        </Form>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <h2 className="font-medium text-lg">Database</h2>
            <p className="text-muted-foreground text-sm">
              Connect your database to your project
            </p>
          </div>
          <Button>Connect Database</Button>
        </div>
      </CardContent>
    </Card>
  );
}
