import { FlowBuilder } from "~/components/flow-builder";

export default async function Workspace({
  _params,
}: {
  _params: { workspace_id: string };
}): Promise<JSX.Element> {
  // TODO: check if the workspace exists
  return <FlowBuilder />;
}
