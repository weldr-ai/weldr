import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@weldr/api";
import { updateProjectSchema } from "@weldr/shared/validators/projects";
import { Button } from "@weldr/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@weldr/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@weldr/ui/form";
import { toast } from "@weldr/ui/hooks/use-toast";
import { Input } from "@weldr/ui/input";
import { DownloadIcon, LoaderIcon } from "lucide-react";

import { getProjectDownloadUrl } from "@/lib/actions/get-project-download-url";
import { api } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export function GeneralSection({
  project,
}: { project: RouterOutputs["projects"]["byId"] }) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);

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
        name: project.name ?? "",
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
        name: result.name ?? "",
        subdomain: result.subdomain,
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>
          Update your project name and subdomain, download your project code, or
          delete your project.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex flex-col">
            <h3 className="font-medium">General</h3>
            <p className="text-muted-foreground text-sm">
              General project settings
            </p>
          </div>
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
                          .weldr.app
                        </span>
                      </div>
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
                    <LoaderIcon className="mr-2 size-3.5 animate-spin" />
                  )}
                  Update
                </Button>
              </div>
            </form>
          </Form>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border p-4">
          <div className="flex flex-col">
            <h3 className="font-medium">Download Project</h3>
            <p className="text-muted-foreground text-sm">
              Download your project code.
            </p>
          </div>
          <Button
            size="sm"
            disabled={isDownloading}
            onClick={async () => {
              setIsDownloading(true);
              const url = await getProjectDownloadUrl({
                projectId: project.id,
              });
              window.open(url, "_blank");
              setIsDownloading(false);
            }}
          >
            {isDownloading ? (
              <LoaderIcon className="mr-2 size-4 animate-spin" />
            ) : (
              <DownloadIcon className="mr-2 size-4" />
            )}
            Download
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border p-4">
          <div className="flex flex-col">
            <h3 className="font-medium">Delete Project</h3>
            <p className="text-muted-foreground text-sm">
              Permanently delete your project and all associated data.
            </p>
          </div>
          <Button variant="destructive" size="sm">
            Delete Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
