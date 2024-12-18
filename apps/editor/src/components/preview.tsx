import { Button } from "@integramind/ui/button";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import {
  AppWindowIcon,
  BoltIcon,
  DatabaseIcon,
  PackageIcon,
  WorkflowIcon,
} from "lucide-react";

export function Preview() {
  return (
    <div className="flex size-full min-h-screen bg-background dark:bg-muted">
      <div className="flex flex-col">
        <header className="flex h-14 items-center border-b bg-muted">
          <Button variant="ghost" size="icon" className="size-14 p-2">
            <LogoIcon className="size-10" />
            <span className="sr-only">IntegraMind</span>
          </Button>
        </header>

        <div className="sticky flex h-[calc(100dvh-56px)]">
          <div className="flex h-full w-14 flex-col items-center py-2.5">
            <div className="flex flex-col gap-2">
              <Button size="icon" variant="ghost">
                <AppWindowIcon className="size-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <span className="text-[11px] font-bold">API</span>
              </Button>
              <Button size="icon" variant="ghost">
                <WorkflowIcon className="size-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <PackageIcon className="size-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <DatabaseIcon className="size-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <BoltIcon className="size-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex min-h-full w-full py-2.5 pr-2.5">
        <div className="flex size-full flex-col items-center justify-center gap-2 rounded-lg border bg-background">
          <h1 className="text-2xl font-medium">IntegraMind</h1>
          <span className="text-muted-foreground">
            Build • Automate • Accelerate
          </span>
        </div>
      </main>
    </div>
  );
}
