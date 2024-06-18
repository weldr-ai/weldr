import { AppWindowMacIcon, ServerIcon, WebhookIcon } from "lucide-react";

import { Badge } from "@integramind/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@integramind/ui/tabs";

export function UseCases() {
  return (
    <div
      id="use-cases"
      className="flex size-full scroll-mt-32 flex-col items-center gap-20"
    >
      <div className="flex flex-col items-center justify-center gap-6">
        <Badge className="rounded-full border border-primary bg-background text-primary">
          Use Cases
        </Badge>
        <h2 className="max-w-3xl text-center text-4xl font-semibold leading-snug">
          Empower your team with effortless automation and more!
        </h2>
      </div>
      <div className="size-full">
        <Tabs defaultValue="use-case-1">
          <div className="flex size-full flex-col items-center justify-center gap-10">
            <TabsList className="w-2/3">
              <TabsTrigger value="use-case-1" className="w-full">
                Backend APIs
              </TabsTrigger>
              <TabsTrigger value="use-case-2" className="w-full">
                Automation Workflows
              </TabsTrigger>
              <TabsTrigger value="use-case-3" className="w-full">
                Data Pipelines
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="use-case-1"
              className="min-h-72 w-full space-y-10 rounded-xl border p-10"
            >
              <div className="flex w-full flex-col items-center justify-center gap-4">
                <h3 className="text-3xl font-semibold">Backend APIs</h3>
                <p className="max-w-xl text-center">
                  Create custom APIs that can be used by your team to build
                  custom tools and integrate with other systems and frontend
                  applications
                </p>
              </div>
              <div className="flex size-full h-96 items-center justify-center gap-8">
                <div className="grid w-64 grid-cols-1 gap-2">
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-emerald-600 text-emerald-600 shadow">
                    Create
                  </div>
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-blue-600 text-blue-600 shadow">
                    Retrieve
                  </div>
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-amber-600 text-amber-600 shadow">
                    Update
                  </div>
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-pink-600 text-pink-600 shadow">
                    Delete
                  </div>
                </div>
                <div className="w-64 border-b" />
                <div className="flex flex-col gap-4">
                  <AppWindowMacIcon className="size-16 stroke-1" />
                  <ServerIcon className="size-16 stroke-1" />
                  <WebhookIcon className="size-16 stroke-1" />
                </div>
              </div>
            </TabsContent>
            <TabsContent
              value="use-case-2"
              className="min-h-72 w-full space-y-10 rounded-xl border p-10"
            >
              <div className="flex w-full flex-col items-center justify-center gap-4">
                <h3 className="text-3xl font-semibold">Automation Workflows</h3>
                <p className="max-w-xl text-center">
                  Create custom workflows that to automate repetitive tasks and
                  streamline your business processes
                </p>
              </div>
              <div className="flex size-full h-96 flex-col items-center justify-center">
                <div className="flex h-16 w-1/3 items-center justify-center rounded-xl border border-pink-600 text-pink-600 shadow">
                  User Submits Feedback
                </div>
                <div className="h-20 border-l" />
                <div className="flex h-16 w-1/3 items-center justify-center rounded-xl border border-amber-600 text-amber-600 shadow">
                  Identify Feedback Type
                </div>
                <div className="h-20 border-l" />
                <div className="flex h-16 w-1/3 items-center justify-center rounded-xl border border-emerald-600 text-emerald-600 shadow">
                  Forward to Relevant Department
                </div>
              </div>
            </TabsContent>
            <TabsContent
              value="use-case-3"
              className="w-full space-y-10 rounded-xl border p-10"
            >
              <div className="flex w-full flex-col items-center justify-center gap-4">
                <h3 className="text-3xl font-semibold">Data Pipelines</h3>
                <p className="max-w-xl text-center">
                  Create custom data pipelines that extract, transform, and load
                  data from various sources
                </p>
              </div>
              <div className="flex size-full h-96 items-center justify-center">
                <div className="flex flex-col gap-10">
                  <div className="flex items-center justify-center">
                    <div className="flex min-h-16 w-64 items-center justify-center rounded-xl border border-amber-600 text-amber-600 shadow">
                      Get sales data from CRM
                    </div>
                    <div className="w-32 border-b" />
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="flex min-h-16 w-64 items-center justify-center rounded-xl border border-amber-600 text-amber-600 shadow">
                      Get inventory data from ERP
                    </div>
                    <div className="w-32 border-b" />
                  </div>
                </div>
                <div className="h-[105px] border-l" />
                <div className="w-32 border-b" />
                <div className="flex min-h-16 w-64 items-center justify-center rounded-xl border border-blue-600 text-blue-600 shadow">
                  Merge data
                </div>
                <div className="w-32 border-b" />
                <div className="flex min-h-16 w-64 items-center justify-center rounded-xl border border-emerald-600 text-emerald-600 shadow">
                  Store in centralized database
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
