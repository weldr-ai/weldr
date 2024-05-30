import { CreateWorkflowDialog } from "~/components/create-workflow-dialog";

export function WorkflowsPrimarySidebar() {
  return (
    <div className="grid w-full gap-2 overflow-y-auto">
      <CreateWorkflowDialog />
    </div>
  );
}
