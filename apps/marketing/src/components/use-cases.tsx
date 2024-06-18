import Image from "next/image";
import { AppWindowMacIcon, ServerIcon, WebhookIcon } from "lucide-react";

import { Badge } from "@integramind/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@integramind/ui/tabs";

export function UseCases() {
  return (
    <div
      id="use-cases"
      className="flex size-full scroll-mt-32 flex-col items-center justify-center gap-8 md:gap-20"
    >
      <div className="flex flex-col items-center justify-center gap-4 md:gap-6">
        <Badge className="rounded-full border border-primary bg-background text-primary">
          Use Cases
        </Badge>
        <h2 className="text-center text-2xl font-semibold leading-snug md:max-w-3xl md:text-4xl">
          Empower your team with effortless automation and more!
        </h2>
      </div>
      <div className="size-full">
        <Tabs defaultValue="use-case-1" className="hidden md:block">
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
              <div className="flex w-full flex-col items-center justify-center gap-4 text-center">
                <h3 className="text-3xl font-semibold">Backend APIs</h3>
                <p className="max-w-xl">
                  Create custom APIs that integrate with other systems and
                  frontend applications
                </p>
              </div>
              <div className="flex size-full items-center justify-center gap-8">
                <div className="grid w-64 grid-cols-1 gap-2">
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-emerald-600 text-center text-emerald-600 shadow">
                    Create
                  </div>
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-blue-600 text-center text-blue-600 shadow">
                    Retrieve
                  </div>
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-amber-600 text-center text-amber-600 shadow">
                    Update
                  </div>
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-pink-600 text-center text-pink-600 shadow">
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
              <div className="flex size-full flex-col items-center justify-center">
                <div className="flex h-16 w-1/3 items-center justify-center rounded-xl border border-pink-600 text-center text-pink-600 shadow">
                  User Submits Feedback
                </div>
                <div className="h-20 border-l" />
                <div className="flex h-16 w-1/3 items-center justify-center rounded-xl border border-amber-600 text-center text-amber-600 shadow">
                  Identify Feedback Type
                </div>
                <div className="h-20 border-l" />
                <div className="flex h-16 w-1/3 items-center justify-center rounded-xl border border-emerald-600 text-center text-emerald-600 shadow">
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
              <div className="flex size-full items-center justify-center">
                <Image
                  className="size-full object-contain"
                  src="/data-pipelines.svg"
                  alt="Data Pipelines"
                  width={1920}
                  height={1080}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <div className="block size-full md:hidden">
          <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="flex size-full flex-col items-center justify-center gap-6 rounded-xl border p-6">
              <div className="flex w-full flex-col items-center justify-center gap-4 text-center">
                <h3 className="text-2xl font-semibold">Backend APIs</h3>
                <p className="text-sm">
                  Create custom APIs that integrate with other systems and
                  frontend applications
                </p>
              </div>
              <div className="flex size-full items-center justify-center gap-4">
                <div className="grid w-full grid-cols-1 gap-2 text-xs">
                  <div className="flex h-10 w-full items-center justify-center rounded-lg border border-emerald-600 text-emerald-600 shadow">
                    Create
                  </div>
                  <div className="flex h-10 w-full items-center justify-center rounded-lg border border-blue-600 text-blue-600 shadow">
                    Retrieve
                  </div>
                  <div className="flex h-10 w-full items-center justify-center rounded-lg border border-amber-600 text-amber-600 shadow">
                    Update
                  </div>
                  <div className="flex h-10 w-full items-center justify-center rounded-lg border border-pink-600 text-pink-600 shadow">
                    Delete
                  </div>
                </div>
                <div className="w-full border-b" />
                <div className="flex flex-col gap-4">
                  <AppWindowMacIcon className="size-14 stroke-1" />
                  <ServerIcon className="size-14 stroke-1" />
                  <WebhookIcon className="size-14 stroke-1" />
                </div>
              </div>
            </div>
            <div className="flex size-full flex-col items-center justify-center gap-6 rounded-xl border p-6">
              <div className="flex w-full flex-col items-center justify-center gap-4 text-center">
                <h3 className="text-2xl font-semibold">Automation Workflows</h3>
                <p className="text-sm">
                  Create custom workflows that to automate repetitive tasks and
                  streamline your business processes
                </p>
              </div>
              <div className="flex size-full flex-col items-center justify-center text-xs">
                <div className="flex h-12 w-full items-center justify-center rounded-lg border border-pink-600 text-pink-600 shadow">
                  User Submits Feedback
                </div>
                <div className="h-10 border-l" />
                <div className="flex h-12 w-full items-center justify-center rounded-lg border border-amber-600 text-amber-600 shadow">
                  Identify Feedback Type
                </div>
                <div className="h-10 border-l" />
                <div className="flex h-12 w-full items-center justify-center rounded-lg border border-emerald-600 text-emerald-600 shadow">
                  Forward to Relevant Department
                </div>
              </div>
            </div>
            <div className="flex size-full flex-col items-center justify-center gap-6 rounded-xl border p-6">
              <div className="flex w-full flex-col items-center justify-center gap-4 text-center">
                <h3 className="text-2xl font-semibold">Data Pipelines</h3>
                <p className="text-sm">
                  Create custom data pipelines that extract, transform, and load
                  data from various sources
                </p>
              </div>
              <div className="flex size-full flex-col items-center justify-center text-xs">
                <Image
                  src="/data-pipelines-mobile.svg"
                  alt="Data Pipelines"
                  width={1920}
                  height={1080}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
