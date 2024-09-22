import { notFound } from "next/navigation";
import { api } from "~/lib/trpc/rsc";

export default async function WorkspacePage({
  params,
}: {
  params: { workspaceId: string };
}): Promise<JSX.Element> {
  try {
    const workspace = await api.workspaces.getById({ id: params.workspaceId });
    return (
      <div className="flex size-full">
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-[#F0F0F3] dark:bg-background rounded-md shadow">
          <h1 className="text-2xl font-medium">{workspace.name}</h1>
          <span className="text-muted-foreground">
            Build • Automate • Accelerate
          </span>
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}
