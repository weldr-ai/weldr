import type { EdgeProps } from "@xyflow/react";
import {
  EdgeLabelRenderer,
  getBezierPath,
  useInternalNode,
  useReactFlow,
} from "@xyflow/react";
import { XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@integramind/ui/button";

import { api } from "~/lib/trpc/react";

export default function DeletableEdge({
  id,
  source,
  target,
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
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { setEdges } = useReactFlow();
  const [isDeleteButtonVisible, setIsDeleteButtonVisible] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX: targetX + 5,
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
        <path
          id={id}
          className="react-flow__edge-path"
          d={edgePath}
          markerEnd={markerEnd}
          style={style}
        />
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
