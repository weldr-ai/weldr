import type { NodeProps } from "reactflow";
import type { Descendant } from "slate";
import React, { memo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  FileText,
  MoreHorizontal,
  PanelRight,
  Play,
  PlayCircle,
  Trash,
  X,
} from "lucide-react";
import { Handle, NodeResizeControl, NodeResizer, Position } from "reactflow";

import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { Input } from "@integramind/ui/input";
import { ScrollArea } from "@integramind/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@integramind/ui/table";

import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { TextHighlighter } from "~/components/text-highlighter";

interface QueryResourceNodeProps extends NodeProps {
  data: {
    id: string;
    description?: string;
  };
  isConnectable: boolean;
}

const employees = [
  {
    name: "Joe Smith",
    department: "Finance",
  },
  {
    name: "Joe Smith",
    department: "Finance",
  },
  {
    name: "Joe Smith",
    department: "Finance",
  },
  {
    name: "Joe Smith",
    department: "Finance",
  },
  {
    name: "Joe Smith",
    department: "Finance",
  },
  {
    name: "Joe Smith",
    department: "Finance",
  },
  {
    name: "Joe Smith",
    department: "Finance",
  },
  {
    name: "Joe Smith",
    department: "Finance",
  },
];

export const QueryResourceNode = memo(
  ({ data, isConnectable }: QueryResourceNodeProps) => {
    const [text, setText] = useState<Descendant[]>([
      {
        children: [
          {
            text: "Get the name and department of all employees from @DB1 based on >age where age is higher than or equal to 30.",
          },
        ],
      },
    ]);

    const [showCardOutput, setShowCardOutput] = useState<boolean>(false);
    const [showOutput, setShowOutput] = useState<boolean>(true);
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
    const [isDeleteAlertDialogOpen, setIsDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const handleContextMenu = (
      event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    ) => {
      event.preventDefault();
      setIsMenuOpen(true);
    };

    return (
      <>
        <NodeResizeControl />
        <NodeResizer
          handleClassName="border-none bg-transparent"
          minWidth={384}
          minHeight={140}
        />
        <Handle
          type="source"
          className="border-border bg-background p-1"
          position={Position.Top}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <Card className="flex h-full w-full min-w-96 flex-col px-3 pb-3">
          <div
            onContextMenu={handleContextMenu}
            className="flex w-full items-center justify-between py-3"
          >
            <div className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              <Input
                className="h-fit w-full border-none bg-transparent px-2 text-xs font-semibold hover:cursor-text hover:bg-accent focus:bg-background"
                defaultValue={data.id}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                className="size-6"
                onClick={() => setShowCardOutput(true)}
                variant="ghost"
                size="icon"
              >
                <Play className="size-3 text-success" />
              </Button>
              <Button className="size-6" variant="ghost" size="icon">
                <PanelRight className="size-3" />
              </Button>
              <DropdownMenu
                open={isMenuOpen}
                onOpenChange={(open) => setIsMenuOpen(open)}
              >
                <DropdownMenuTrigger asChild>
                  <Button className="size-6" variant="ghost" size="icon">
                    <MoreHorizontal className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="right"
                  className="w-56"
                >
                  <DropdownMenuLabel className="flex items-center justify-between py-0.5 text-xs">
                    Query Resource
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs">
                    <PlayCircle className="mr-3 size-4 text-muted-foreground" />
                    Run with previous blocks
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center justify-between text-xs">
                    <Link
                      className="flex items-center"
                      href="https://docs.integramind.ai/query-resource"
                      target="blank"
                    >
                      <FileText className="mr-3 size-4 text-muted-foreground" />
                      Docs
                    </Link>
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex text-xs text-destructive hover:text-destructive focus:text-destructive/90"
                    onClick={() => setIsDeleteAlertDialogOpen(true)}
                  >
                    <Trash className="mr-3 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DeleteAlertDialog
                open={isDeleteAlertDialogOpen}
                onOpenChange={setIsDeleteAlertDialogOpen}
              />
            </div>
          </div>

          <div className="flex h-full w-full">
            <TextHighlighter value={text} onValueChange={setText} />
          </div>
        </Card>
        {showCardOutput && (
          <Card className="mt-2 flex min-w-96 flex-col gap-2 px-3 py-2">
            <div className="flex w-full items-center justify-between">
              <div className="flex gap-1">
                <span className="text-xs font-semibold text-success">list</span>
                <span className="text-xs font-semibold">(50)</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setShowOutput(!showOutput)}
                  className="size-6"
                  variant="ghost"
                  size="icon"
                >
                  {showOutput ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )}
                </Button>
                <Button
                  onClick={() => setShowCardOutput(false)}
                  className="size-6"
                  variant="ghost"
                  size="icon"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>
            {showOutput && (
              <Table className="flex min-h-32 w-full flex-col">
                <TableHeader className="flex w-full flex-col">
                  <TableRow className="flex w-full flex-row">
                    <TableHead className="flex w-full">age</TableHead>
                    <TableHead className="flex w-full">department</TableHead>
                  </TableRow>
                </TableHeader>
                <ScrollArea className="nowheel h-32">
                  <TableBody className="flex flex-col">
                    {employees.map((employee, idx) => (
                      <TableRow
                        className="flex w-full flex-row"
                        key={`${employee.name}-${idx}`}
                      >
                        <TableCell className="flex w-full">
                          {employee.name}
                        </TableCell>
                        <TableCell className="flex w-full">
                          {employee.department}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </ScrollArea>
              </Table>
            )}
          </Card>
        )}
        <Handle
          type="target"
          className="border-border bg-background p-1"
          position={Position.Bottom}
          isConnectable={isConnectable}
        />
      </>
    );
  },
);

QueryResourceNode.displayName = "QueryResourceNode";
