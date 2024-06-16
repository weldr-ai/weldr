import { Tabs, TabsContent, TabsList, TabsTrigger } from "@integramind/ui/tabs";

export function UseCases() {
  return (
    <div
      id="use-cases"
      className="flex size-full scroll-mt-20 flex-col items-center gap-20"
    >
      <h2 className="max-w-3xl text-center text-4xl font-semibold leading-snug">
        Empower your team with effortless automation and more!
      </h2>
      <div className="flex size-full rounded-xl border p-10">
        <Tabs
          defaultValue="use-case-1"
          className="flex size-full flex-col items-center space-y-10"
        >
          <TabsList className="flex w-2/3">
            <TabsTrigger value="use-case-1" className="w-full">
              APIs
            </TabsTrigger>
            <TabsTrigger value="use-case-2" className="w-full">
              Automation Workflows
            </TabsTrigger>
            <TabsTrigger value="use-case-3" className="w-full">
              Integrations
            </TabsTrigger>
            <TabsTrigger value="use-case-4" className="w-full">
              Data Pipelines
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="use-case-1"
            className="size-full min-h-96 rounded-xl border"
          >
            <div></div>
          </TabsContent>
          <TabsContent
            value="use-case-2"
            className="size-full min-h-96 rounded-xl border"
          ></TabsContent>
          <TabsContent
            value="use-case-3"
            className="size-full min-h-96 rounded-xl border"
          ></TabsContent>
          <TabsContent
            value="use-case-4"
            className="size-full min-h-96 rounded-xl border"
          ></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
