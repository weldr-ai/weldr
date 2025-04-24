import type { uiTransitionSchema } from "@weldr/shared/validators/declarations/component";
import { Card } from "@weldr/ui/card";
import { cn } from "@weldr/ui/utils";
import { ArrowDownIcon } from "lucide-react";
import type { z } from "zod";

interface UiTransitionVisualizerProps {
  transitions: z.infer<typeof uiTransitionSchema>[];
  className?: string;
}

export function UiTransitionVisualizer({
  transitions,
  className,
}: UiTransitionVisualizerProps) {
  return (
    <div className={cn("space-y-2 text-xs", className)}>
      {transitions.map((transition, index) => (
        <Card
          key={`transition-${transition.when.description}-${index}`}
          className="space-y-2 p-3"
        >
          {/* Trigger Condition */}
          <div className="flex items-start gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="font-medium text-muted-foreground">When:</span>
                <p>{transition.when.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-muted-foreground">Event:</p>
                <p>{transition.when.event}</p>
              </div>
              {transition.when.guard && transition.when.guard.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground">Only if:</p>
                  <ul className="list-inside list-disc">
                    {transition.when.guard.map((guard) => (
                      <li key={`guard-${guard}`}>{guard}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* State Transition */}
          <div className="grid gap-1">
            {/* From State */}
            <div className="rounded-lg border bg-muted/50 p-2.5">
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <h4 className="font-medium text-muted-foreground">From:</h4>
                  <span>{transition.from.state}</span>
                </div>
                {transition.from.data && (
                  <div className="flex gap-1">
                    <span className="shrink-0 font-medium text-muted-foreground">
                      Data:
                    </span>
                    <span>{transition.from.data}</span>
                  </div>
                )}
                {((transition.from.visible &&
                  transition.from.visible.length > 0) ||
                  (transition.from.enabled &&
                    transition.from.enabled.length > 0)) && (
                  <div className="grid grid-cols-2 gap-2">
                    {transition.from.visible &&
                      transition.from.visible.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground">Can see:</p>
                          <ul className="list-inside list-disc">
                            {transition.from.visible.map((item) => (
                              <li key={`from-visible-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {transition.from.enabled &&
                      transition.from.enabled.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground">
                            Can interact with:
                          </p>
                          <ul className="list-inside list-disc">
                            {transition.from.enabled.map((item) => (
                              <li key={`from-enabled-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>

            {/* Transition Arrow and Effects */}
            <div className="flex items-center gap-1 py-0.5">
              <ArrowDownIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
              {transition.effects && transition.effects.length > 0 && (
                <div className="flex-1">
                  <span className="font-medium text-muted-foreground">
                    Effects:{" "}
                  </span>
                  <span>{transition.effects.join(", ")}</span>
                </div>
              )}
            </div>

            {/* To State */}
            <div className="rounded-lg border bg-muted/50 p-2.5">
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <h4 className="font-medium text-muted-foreground">To:</h4>
                  <span>{transition.to.state}</span>
                </div>
                {transition.to.data && (
                  <div className="flex gap-1">
                    <span className="shrink-0 font-medium text-muted-foreground">
                      Data:
                    </span>
                    <span>{transition.to.data}</span>
                  </div>
                )}
                {((transition.to.visible && transition.to.visible.length > 0) ||
                  (transition.to.enabled &&
                    transition.to.enabled.length > 0)) && (
                  <div className="grid grid-cols-2 gap-2">
                    {transition.to.visible &&
                      transition.to.visible.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground">Can see:</p>
                          <ul className="list-inside list-disc">
                            {transition.to.visible.map((item) => (
                              <li key={`to-visible-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {transition.to.enabled &&
                      transition.to.enabled.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground">
                            Can interact with:
                          </p>
                          <ul className="list-inside list-disc">
                            {transition.to.enabled.map((item) => (
                              <li key={`to-enabled-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
