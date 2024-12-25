import { DeleteAlertDialog } from "@/components/delete-alert-dialog";
import { api } from "@/lib/trpc/client";
import type { CanvasNode, CanvasNodeProps } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@integramind/api";
import { updateModuleSchema } from "@integramind/shared/validators/modules";
import { Card, CardHeader } from "@integramind/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@integramind/ui/context-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@integramind/ui/form";
import { toast } from "@integramind/ui/hooks/use-toast";
import { Input } from "@integramind/ui/input";
import { Textarea } from "@integramind/ui/textarea";
import { cn } from "@integramind/ui/utils";
import {
  NodeResizer,
  type ResizeDragEvent,
  type ResizeParams,
  useReactFlow,
} from "@xyflow/react";
import {
  ExternalLinkIcon,
  FileTextIcon,
  PackageIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { debounce } from "perfect-debounce";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export const ModuleNode = memo(({ data: _data, selected }: CanvasNodeProps) => {
  const { deleteElements, updateNodeData } = useReactFlow<CanvasNode>();

  const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
    useState<boolean>(false);

  const { data: fetchedData } = api.modules.byId.useQuery(
    {
      id: _data.id,
    },
    {
      initialData: _data as RouterOutputs["modules"]["byId"],
    },
  );

  const data = fetchedData;

  const [size, setSize] = useState({
    width: data.width ?? 600,
    height: data.height ?? 400,
  });

  const apiUtils = api.useUtils();

  const updateModule = api.modules.update.useMutation({
    onSuccess: (data) => {
      apiUtils.modules.byId.invalidate({
        id: data.id,
      });
      updateNodeData(data.id, data);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const deleteModule = api.modules.delete.useMutation();

  const form = useForm<z.infer<typeof updateModuleSchema>>({
    resolver: zodResolver(updateModuleSchema),
    defaultValues: {
      where: {
        id: data.id,
      },
      payload: {
        name: data.name ?? "",
        description: data.description ?? "",
      },
    },
  });

  const debouncedUpdate = useMemo(
    () =>
      debounce(
        async (values: z.infer<typeof updateModuleSchema>) => {
          await updateModule.mutateAsync({
            where: {
              id: data.id,
            },
            payload: {
              name: values.payload.name,
              description: values.payload.description,
            },
          });
        },
        500,
        { trailing: false },
      ),
    [data.id, updateModule],
  );

  const onFormChange = (values: z.infer<typeof updateModuleSchema>) => {
    debouncedUpdate(values);
  };

  useEffect(() => {
    if (data.name) {
      return;
    }
    form.setError("payload.name", {
      type: "required",
      message: "Name is required",
    });
  }, [form.setError, data.name]);

  const onResize = useCallback(
    (_event: ResizeDragEvent, params: ResizeParams) => {
      requestAnimationFrame(() => {
        setSize({
          width: Math.floor(params.width),
          height: Math.floor(params.height),
        });
      });
    },
    [],
  );

  const onResizeEnd = useCallback(
    async (_event: ResizeDragEvent, params: ResizeParams) => {
      await updateModule.mutateAsync({
        where: { id: data.id },
        payload: {
          width: Math.floor(params.width),
          height: Math.floor(params.height),
        },
      });
    },
    [data.id, updateModule],
  );

  const [showDescription, setShowDescription] = useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <Card
            className={cn("drag-handle dark:bg-muted", {
              "border-primary": selected,
            })}
            style={{ height: size.height, width: size.width }}
          >
            <CardHeader className="border-b p-4">
              <div className="flex gap-2">
                <PackageIcon className="size-4 text-primary" />
                <span className="text-muted-foreground text-xs">Module</span>
                <button
                  type="button"
                  className="ml-auto text-muted-foreground text-xs hover:text-foreground"
                  onClick={() => setShowDescription(!showDescription)}
                >
                  {showDescription ? "Hide" : "Show"} Description
                </button>
              </div>
              <Form {...form}>
                <form onChange={form.handleSubmit(onFormChange)}>
                  <FormField
                    control={form.control}
                    name="payload.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="off"
                            className="h-8 w-full border-none p-0 text-base shadow-none focus-visible:ring-0 dark:bg-muted"
                            placeholder="Enter module name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {showDescription && (
                    <FormField
                      control={form.control}
                      name="payload.description"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              {...field}
                              autoComplete="off"
                              className="min-h-8 w-full border-none p-0 text-muted-foreground text-sm shadow-none focus-visible:ring-0 dark:bg-muted"
                              placeholder="Enter module description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </form>
              </Form>
            </CardHeader>
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel className="text-xs">Module</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem className="flex items-center justify-between text-xs">
            <Link
              className="flex items-center"
              href="https://docs.integramind.ai/modules"
              target="blank"
            >
              <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
              Docs
            </Link>
            <ExternalLinkIcon className="size-3 text-muted-foreground" />
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="flex text-destructive text-xs hover:text-destructive focus:text-destructive/90"
            onClick={() => setDeleteAlertDialogOpen(true)}
          >
            <TrashIcon className="mr-3 size-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <NodeResizer
        handleClassName="bg-transparent border-none"
        lineClassName="bg-transparent border-none"
        minWidth={300}
        minHeight={50}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
      />
      <DeleteAlertDialog
        open={deleteAlertDialogOpen}
        setOpen={setDeleteAlertDialogOpen}
        onDelete={() => {
          deleteElements({
            nodes: [
              {
                id: data.id,
              },
            ],
          });
          deleteModule.mutate({
            id: data.id,
          });
        }}
      />
    </>
  );
});
