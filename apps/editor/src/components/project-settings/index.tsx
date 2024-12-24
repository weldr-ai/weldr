"use client";

import type { RouterOutputs } from "@integramind/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@integramind/ui/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { EnvSection } from "./env-section";
import { GeneralSection } from "./general-section";
import { IntegrationsSection } from "./integrations-section";

type Tab = "general" | "integrations" | "env";

export function ProjectSettings({
  project,
}: { project: RouterOutputs["projects"]["byId"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTab = (searchParams.get("tab") ?? "general") as Tab;

  const [activeTab, setActiveTab] = useState<Tab>(currentTab);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(name, value);
      return params.toString();
    },
    [searchParams],
  );

  return (
    <Tabs defaultValue={activeTab} className="flex flex-1 gap-4">
      <TabsList className="flex h-fit w-[230px] flex-col gap-2 p-2.5">
        <TabsTrigger
          className="w-full justify-start"
          value="general"
          onClick={() => {
            setActiveTab("general");
            router.push(`${pathname}?${createQueryString("tab", "general")}`);
          }}
        >
          General
        </TabsTrigger>
        <TabsTrigger
          className="w-full justify-start"
          value="integrations"
          onClick={() => {
            setActiveTab("integrations");
            router.push(
              `${pathname}?${createQueryString("tab", "integrations")}`,
            );
          }}
        >
          Integrations
        </TabsTrigger>
        <TabsTrigger
          className="w-full justify-start"
          value="env"
          onClick={() => {
            setActiveTab("env");
            router.push(`${pathname}?${createQueryString("tab", "env")}`);
          }}
        >
          Environment Variables
        </TabsTrigger>
      </TabsList>

      <div className="flex-1">
        <TabsContent value="general" className="mt-0 space-y-4">
          <GeneralSection project={project} />
        </TabsContent>

        <TabsContent value="integrations" className="mt-0">
          <IntegrationsSection project={project} />
        </TabsContent>

        <TabsContent value="env" className="mt-0">
          <EnvSection project={project} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
