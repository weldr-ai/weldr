import { FlowBuilder } from "~/components/flow-builder";

export default async function Workflow({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  // TODO: check if the workflow exists
  return <FlowBuilder />;
}
