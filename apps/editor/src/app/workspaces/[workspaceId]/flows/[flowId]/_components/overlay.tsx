"use client";

import { Button } from "@integramind/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@integramind/ui/card";
import { XIcon } from "lucide-react";
import { useOnboardingStore } from "~/lib/store";

export function Overlay({
  show,
}: {
  show: boolean;
}) {
  const { onboardedFlows, markFlowAsOnboarded } = useOnboardingStore();

  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-left bg-black/50 rounded-lg">
      {!onboardedFlows.has("flow-schema") && (
        <Card className="relative ml-36 max-w-sm space-y-2">
          <CardHeader className="p-4 pb-0">
            <div className="flex items-center gap-2">
              <div className="flex-1" />
              <CardTitle>Welcome!</CardTitle>
              <div className="flex-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => markFlowAsOnboarded("flow-schema")}
                  className="size-7"
                >
                  <XIcon className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-center">
              Please chat with the assistant to create an input schema before
              assembling your flow.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
