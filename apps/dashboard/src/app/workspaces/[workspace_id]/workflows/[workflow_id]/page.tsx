import { FlowBuilder } from "~/components/flow-builder";

export default async function Workflow({
  _params,
}: {
  _params: { workflow_id: string };
}): Promise<JSX.Element> {
  // TODO: check if the workflow exists
  return <FlowBuilder />;
}
