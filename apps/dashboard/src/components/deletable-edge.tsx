import type { EdgeProps } from "@xyflow/react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import { XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@specly/ui/button";

import { api } from "~/lib/trpc/react";

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [isDeleteButtonVisible, setIsDeleteButtonVisible] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const deleteEdge = api.edges.delete.useMutation();

  const onEdgeClick = async () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
    await deleteEdge.mutateAsync({
      id,
    });
  };

  return (
    <>
      <g
        onMouseEnter={() => setIsDeleteButtonVisible(true)}
        onMouseLeave={() => setIsDeleteButtonVisible(false)}
      >
        <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
        {(isDeleteButtonVisible || selected) && (
          <EdgeLabelRenderer>
            <Button
              className="size-3.5 rounded-full"
              onClick={onEdgeClick}
              variant="destructive"
              size="icon"
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: "all",
              }}
            >
              <XIcon className="size-2.5" />
            </Button>
          </EdgeLabelRenderer>
        )}
      </g>
    </>
  );
}
