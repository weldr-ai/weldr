import type { EdgeProps } from "reactflow";
import React from "react";
import { SmoothStepEdge } from "reactflow";

export default function FlowEdge(props: EdgeProps) {
  return (
    <>
      <SmoothStepEdge {...props} />
    </>
  );
}
