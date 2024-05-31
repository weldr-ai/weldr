import { notFound } from "next/navigation";

import { getWorkspaceById } from "~/lib/actions/workspaces";

export default async function Workspace({
  params,
}: {
  params: { workspaceId: string };
}): Promise<JSX.Element> {
  const workspace = await getWorkspaceById({ id: params.workspaceId });

  if (!workspace) {
    notFound();
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-medium">{workspace.name}</h1>
      <span className="text-muted-foreground">
        Build • Automate • Accelerate
      </span>
    </div>
  );
}
