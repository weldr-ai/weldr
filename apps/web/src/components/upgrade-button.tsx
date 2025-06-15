"use client";

import { authClient } from "@weldr/auth/client";
import { Button } from "@weldr/ui/components/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import { cn } from "@weldr/ui/lib/utils";

export function UpgradeButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Button
      variant="default"
      size="sm"
      className={cn("h-7 text-xs", className)}
      onClick={async () =>
        await authClient.subscription.upgrade({
          plan: "pro",
          successUrl: "/",
          cancelUrl: "/billing",
          fetchOptions: {
            onError: (_: unknown) => {
              toast({
                variant: "destructive",
                title: "Error upgrading subscription",
                description: "An unknown error occurred",
              });
            },
          },
        })
      }
    >
      {children}
    </Button>
  );
}
