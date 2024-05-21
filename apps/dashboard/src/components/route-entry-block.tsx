"use client";

import type { NodeProps } from "reactflow";
import { memo } from "react";
import { PanelLeft } from "lucide-react";
import { Handle, Position } from "reactflow";

import { Badge } from "@integramind/ui/badge";
import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";

import type { RouteEntryBlockData } from "~/types";
import { useDevelopmentBarStore } from "~/lib/store";

export const RouteEntryBlock = memo(
  ({ data, isConnectable }: NodeProps<RouteEntryBlockData>) => {
    const updateActiveBlock = useDevelopmentBarStore(
      (state) => state.updateActiveBlock,
    );

    return (
      <>
        <Card className="flex h-[86px] w-[256px] flex-col justify-start gap-2 px-5 py-4">
          <div className="flex w-full items-center justify-between text-xs">
            <div className="flex w-full items-center gap-2">
              <Badge variant="default" className="text-xs">
                {data.method}
              </Badge>
              <span className="text-muted-foreground">API Route</span>
            </div>
            <Button
              className="size-6"
              variant="ghost"
              size="icon"
              onClick={() =>
                updateActiveBlock({
                  type: "route-entry-block",
                  data,
                })
              }
            >
              <PanelLeft className="size-3 text-muted-foreground" />
            </Button>
          </div>
          <span className="flex w-full justify-start text-sm">{data.name}</span>
        </Card>
        <Handle
          type="target"
          className="border-border bg-background p-1"
          position={Position.Right}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
      </>
    );
  },
);

RouteEntryBlock.displayName = "RouteEntryBlock";

// <Form {...form}>
// <form className="mt-4 space-y-4">
//   <FormField
//     control={form.control}
//     name="..."
//     render={({ field }) => (
//       <FormItem>
//         <FormLabel className="text-xs">Name</FormLabel>
//         <FormControl>
//           <Input placeholder="Enter route name" {...field} />
//         </FormControl>
//       </FormItem>
//     )}
//   />
//   <FormField
//     control={form.control}
//     name="..."
//     render={({ field }) => (
//       <FormItem>
//         <FormLabel>Description (optional)</FormLabel>
//         <FormControl>
//           <Input placeholder="Enter route name" {...field} />
//         </FormControl>
//       </FormItem>
//     )}
//   />
//   <FormField
//     control={form.control}
//     name="..."
//     render={({ field }) => (
//       <FormItem>
//         <FormLabel>Method</FormLabel>
//         <FormControl>
//           <Select {...field}>
//             <SelectTrigger className="bg-background text-muted-foreground">
//               <SelectValue placeholder="Method" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="GET">GET</SelectItem>
//               <SelectItem value="POST">POST</SelectItem>
//               <SelectItem value="PATCH">PATCH</SelectItem>
//               <SelectItem value="UPDATE">UPDATE</SelectItem>
//             </SelectContent>
//           </Select>
//         </FormControl>
//       </FormItem>
//     )}
//   />
//   <FormField
//     control={form.control}
//     name="..."
//     render={({ field }) => (
//       <FormItem>
//         <FormLabel>URL Path</FormLabel>
//         <FormControl>
//           <Input placeholder="Enter URL path" {...field} />
//         </FormControl>
//       </FormItem>
//     )}
//   />
// </form>
// </Form>
