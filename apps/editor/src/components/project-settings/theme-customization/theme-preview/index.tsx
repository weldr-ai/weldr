import type { Theme, ThemeMode } from "@weldr/shared/types";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@weldr/ui/components/tabs";
import type { UseFormReturn } from "react-hook-form";
import { ThemeWrapper } from "../theme-wrapper";
import { CardsDemo } from "./cards";
import { DashboardDemo } from "./dashboard";
import { MailDemo } from "./mail";
import { MusicDemo } from "./music";
import { TaskDemo } from "./tasks";

export function ThemePreview({
  currentView,
  setCurrentView,
  form,
  mode,
}: {
  currentView: "cards" | "dashboard" | "mail" | "music" | "tasks";
  setCurrentView: (
    view: "cards" | "dashboard" | "mail" | "music" | "tasks",
  ) => void;
  form: UseFormReturn<Theme>;
  mode: ThemeMode;
}) {
  return (
    <Tabs
      value={currentView}
      onValueChange={(value) => setCurrentView(value as typeof currentView)}
    >
      <TabsList>
        <TabsTrigger value="cards">Cards</TabsTrigger>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="mail">Mail</TabsTrigger>
        <TabsTrigger value="music">Music</TabsTrigger>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
      </TabsList>
      <TabsContent value="cards">
        <ThemeWrapper form={form} mode={mode}>
          <CardsDemo mode={mode} />
        </ThemeWrapper>
      </TabsContent>
      <TabsContent value="dashboard">
        <ThemeWrapper form={form} mode={mode}>
          <DashboardDemo />
        </ThemeWrapper>
      </TabsContent>
      <TabsContent value="mail">
        <ThemeWrapper form={form} mode={mode}>
          <MailDemo />
        </ThemeWrapper>
      </TabsContent>
      <TabsContent value="music">
        <ThemeWrapper form={form} mode={mode}>
          <MusicDemo />
        </ThemeWrapper>
      </TabsContent>
      <TabsContent value="tasks">
        <ThemeWrapper form={form} mode={mode}>
          <TaskDemo />
        </ThemeWrapper>
      </TabsContent>
    </Tabs>
  );
}
