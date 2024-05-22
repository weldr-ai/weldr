import type { EdgeProps } from "reactflow";
import { useState } from "react";
import { X } from "lucide-react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from "reactflow";

import { Button } from "@integramind/ui/button";

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

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
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
              <X className="size-2.5" />
            </Button>
          </EdgeLabelRenderer>
        )}
      </g>
    </>
  );
}
