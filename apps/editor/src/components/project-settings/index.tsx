"use client";

import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/components/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@weldr/ui/components/tabs";
import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { EnvSection } from "./env-section";
import { GeneralSection } from "./general-section";
import { IntegrationsSection } from "./integrations-section";

export function ProjectSettings({
  project,
  integrationTemplates,
}: {
  project: RouterOutputs["projects"]["byId"];
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
}) {
  const trpc = useTRPC();

  const { data: env } = useQuery(
    trpc.environmentVariables.list.queryOptions(
      {
        projectId: project.id,
      },
      {
        initialData: project.environmentVariables,
      },
    ),
  );

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = window.navigator?.userAgent.toLowerCase().includes("mac");
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="size-8 dark:bg-muted">
          <SettingsIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex min-h-[calc(100vh-50px)] min-w-[calc(100vw-50px)] flex-col">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="flex flex-1 flex-row gap-4">
          <TabsList className="flex h-fit w-[230px] flex-col p-2.5">
            <TabsTrigger className="w-full justify-start" value="general">
              General
            </TabsTrigger>

            <TabsTrigger className="w-full justify-start" value="integrations">
              Integrations
            </TabsTrigger>
            <TabsTrigger className="w-full justify-start" value="env">
              Environment Variables
            </TabsTrigger>
          </TabsList>

          <div className="flex-1">
            <TabsContent value="general" className="mt-0 space-y-4">
              <GeneralSection project={project} />
            </TabsContent>

            <TabsContent
              value="integrations"
              className="mt-0 h-[calc(100vh-134px)] overflow-hidden"
            >
              <IntegrationsSection
                projectId={project.id}
                integrations={project.integrations}
                integrationTemplates={integrationTemplates}
                environmentVariables={env}
              />
            </TabsContent>

            <TabsContent value="env" className="mt-0">
              <EnvSection env={env} projectId={project.id} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
