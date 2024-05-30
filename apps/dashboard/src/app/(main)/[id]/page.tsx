import { FlowBuilder } from "~/components/flow-builder";

export default async function Project({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  // TODO: check if the project exists
  return <FlowBuilder />;
}
