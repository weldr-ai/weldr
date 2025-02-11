"use client";

import { useView } from "@/lib/store";
import { Button } from "@weldr/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@weldr/ui/tooltip";
import { HistoryIcon, PanelLeftCloseIcon, SparklesIcon } from "lucide-react";
import { MainDropdownMenu } from "./main-dropdown-menu";

export function Sidebar() {
  const { activeTab, setActiveTab } = useView();

  return (
    <div className="flex size-full w-12 flex-col items-center border-r py-2">
      <MainDropdownMenu side="right" />
      <div className="flex flex-col items-center gap-2 pt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`${activeTab === "chat" && "bg-accent"}`}
              onClick={() => setActiveTab("chat")}
            >
              <SparklesIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="border bg-muted">
            <p>Chat</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`${activeTab === "history" && "bg-accent"}`}
              onClick={() => setActiveTab("history")}
            >
              <HistoryIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="border bg-muted">
            <p>History</p>
          </TooltipContent>
        </Tooltip>
      </div>
      {activeTab !== null && (
        <Button
          variant="ghost"
          size="icon"
          className="mt-auto"
          onClick={() => setActiveTab(null)}
        >
          <PanelLeftCloseIcon className="size-4" />
        </Button>
      )}
    </div>
  );
}
