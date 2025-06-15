import { SidebarInset, SidebarProvider } from "@weldr/ui/components/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { ChartAreaInteractive } from "./components/chart-area-interactive";
import { DataTable } from "./components/data-table";
import { SectionCards } from "./components/section-cards";
import { SiteHeader } from "./components/site-header";

import data from "./data.json";

export function DashboardDemo() {
  return (
    <div className="max-h-[calc(100vh-204px)] overflow-hidden">
      <SidebarProvider className="relative">
        <AppSidebar className="absolute h-[calc(100vh-204px)] border-none" />
        <SidebarInset className="border-l">
          <SiteHeader />
          <div className="flex max-h-[calc(100vh-252px)] flex-1 flex-col overflow-y-auto">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <SectionCards />
                <div className="px-4 lg:px-6">
                  <ChartAreaInteractive />
                </div>
                <DataTable data={data} />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
