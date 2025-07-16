"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@weldr/api";
import { isValidHex, isValidHsl } from "@weldr/shared/color-utils";
import type { Theme, ThemeData, ThemeMode } from "@weldr/shared/types";
import { themeSchema } from "@weldr/shared/validators/themes";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@weldr/ui/components/accordion";
import { Button } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@weldr/ui/components/form";
import { Input } from "@weldr/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@weldr/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@weldr/ui/components/select";
import { Slider } from "@weldr/ui/components/slider";
import {
  LoaderIcon,
  MoonIcon,
  PaletteIcon,
  SaveIcon,
  SunIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { HslStringColorPicker } from "react-colorful";
import { type UseFormReturn, useForm } from "react-hook-form";
import type { z } from "zod";
import { ThemePreview } from "./theme-preview";

type ThemeFieldPath = `${ThemeMode}.${keyof ThemeData}`;

export function ThemeCustomization({
  project,
}: {
  project: RouterOutputs["projects"]["byId"];
}) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [currentView, setCurrentView] = useState<
    "cards" | "dashboard" | "mail" | "music" | "tasks"
  >("cards");

  // FIXME: This need to be updated, once I figure out how to handle themes

  const form = useForm<Theme>({
    mode: "onChange",
    resolver: zodResolver(themeSchema),
    defaultValues: {
      // ...project.currentVersion?.theme?.data,
    },
  });

  // const trpc = useTRPC();
  // const queryClient = useQueryClient();

  // const createTheme = useMutation(
  //   trpc.themes.create.mutationOptions({
  //     onSuccess: async () => {
  //       toast({
  //         title: "Theme created",
  //         description: "Your theme has been created",
  //       });
  //       await queryClient.invalidateQueries(
  //         trpc.projects.byId.queryFilter({ id: project.id }),
  //       );
  //       form.reset();
  //     },
  //     onError: () => {
  //       toast({
  //         variant: "destructive",
  //         title: "Error creating theme",
  //         description: "Please try again",
  //       });
  //     },
  //   }),
  // );

  const handleSaveTheme = async (_data: z.infer<typeof themeSchema>) => {
    // await createTheme.mutateAsync({
    //   projectId: project.id,
    //   data,
    // });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PaletteIcon className="mr-2 size-3.5" />
          Edit Theme
        </Button>
      </DialogTrigger>
      <DialogContent className="flex min-h-[calc(100vh-50px)] min-w-[calc(100vw-50px)] flex-col">
        <DialogHeader>
          <DialogTitle>Theme Customization</DialogTitle>
          <DialogDescription>
            Customize the theme of your project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid flex-1 grid-cols-[300px_1fr] gap-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSaveTheme)}
              className="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-transparent flex max-h-[calc(100vh-160px)] flex-col gap-4 overflow-y-auto"
            >
              <Button
                variant="outline"
                size="sm"
                type="submit"
                // disabled={
                //   createTheme.isPending ||
                //   form.formState.isSubmitting ||
                //   !form.formState.isValid ||
                //   fastDeepEqual(
                //     form.getValues(),
                //     project.currentVersion?.theme?.data,
                //   )
                // }
              >
                {
                  // createTheme.isPending ||
                  form.formState.isSubmitting ? (
                    <LoaderIcon className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <SaveIcon className="mr-1 size-3.5" />
                  )
                }
                Save Theme
              </Button>
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">Mode</p>
                <div className="flex items-center gap-2">
                  <Select
                    value={mode}
                    defaultValue={mode}
                    onValueChange={(value) =>
                      setMode(value as "light" | "dark")
                    }
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue
                        placeholder="Select a mode"
                        className="text-xs"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <SunIcon className="size-3.5" />
                        Light
                      </SelectItem>
                      <SelectItem value="dark">
                        <MoonIcon className="size-3.5" />
                        Dark
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <ThemeAccordion form={form} mode={mode} />
            </form>
          </Form>
          <ThemePreview
            currentView={currentView}
            setCurrentView={setCurrentView}
            form={form}
            mode={mode}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorField({
  field,
  label,
  form,
}: {
  field: ThemeFieldPath;
  label: string;
  form: UseFormReturn<Theme>;
}) {
  const value = form.watch(field);

  const handleColorChange = useCallback(
    (input: string) => {
      if (isValidHex(input)) {
        form.setValue(field, input);
        return;
      }

      if (isValidHsl(input)) {
        form.setValue(field, input);
        return;
      }

      form.setError(field, { message: "Invalid color" });
    },
    [form, field],
  );

  return (
    <FormField
      control={form.control}
      name={field}
      render={({ field: formField }) => {
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="grid grid-cols-[36px_auto] items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <div
                    className="size-9 cursor-pointer rounded-md"
                    style={{
                      backgroundColor: value as string,
                    }}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-fit p-0" align="start">
                  <HslStringColorPicker
                    color={value as string}
                    onChange={(color) => handleColorChange(color)}
                  />
                </PopoverContent>
              </Popover>
              <FormControl>
                <Input
                  {...formField}
                  onChange={(e) => handleColorChange(e.target.value)}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function RadiusField({
  mode,
  form,
}: {
  mode: ThemeMode;
  form: UseFormReturn<Theme>;
}) {
  return (
    <FormField
      control={form.control}
      name={`${mode}.radius`}
      render={({ field }) => {
        return (
          <FormItem className="flex flex-col gap-4">
            <FormLabel className="flex items-center justify-between">
              Radius
              <div className="flex items-center gap-1">
                <Input
                  {...field}
                  type="number"
                  className="h-6 w-16 pr-0 pl-2 text-xs"
                />
                <span className="text-muted-foreground text-xs">rem</span>
              </div>
            </FormLabel>
            <Slider
              min={0}
              max={1}
              step={0.125}
              value={[field.value]}
              onValueChange={(values) => field.onChange(values[0])}
            />
          </FormItem>
        );
      }}
    />
  );
}

function ThemeAccordion({
  form,
  mode,
}: {
  form: UseFormReturn<Theme>;
  mode: ThemeMode;
}) {
  const themeGroups = [
    {
      group: "Radius",
      fields: [{ field: `${mode}.radius`, label: "Radius", type: "radius" }],
    },
    {
      group: "Primary Colors",
      fields: [
        { field: `${mode}.primary`, label: "Primary", type: "color" },
        {
          field: `${mode}.primaryForeground`,
          label: "Primary Foreground",
          type: "color",
        },
      ],
    },
    {
      group: "Secondary Colors",
      fields: [
        { field: `${mode}.secondary`, label: "Secondary", type: "color" },
        {
          field: `${mode}.secondaryForeground`,
          label: "Secondary Foreground",
          type: "color",
        },
      ],
    },
    {
      group: "Accent Colors",
      fields: [
        { field: `${mode}.accent`, label: "Accent", type: "color" },
        {
          field: `${mode}.accentForeground`,
          label: "Accent Foreground",
          type: "color",
        },
      ],
    },
    {
      group: "Base Colors",
      fields: [
        { field: `${mode}.background`, label: "Background", type: "color" },
        { field: `${mode}.foreground`, label: "Foreground", type: "color" },
      ],
    },
    {
      group: "Card Colors",
      fields: [
        { field: `${mode}.card`, label: "Card", type: "color" },
        {
          field: `${mode}.cardForeground`,
          label: "Card Foreground",
          type: "color",
        },
      ],
    },
    {
      group: "Popover Colors",
      fields: [
        {
          field: `${mode}.popover`,
          label: "Popover",
          type: "color",
        },
        {
          field: `${mode}.popoverForeground`,
          label: "Popover Foreground",
          type: "color",
        },
      ],
    },
    {
      group: "Destructive Colors",
      fields: [
        { field: `${mode}.destructive`, label: "Destructive", type: "color" },
        {
          field: `${mode}.destructiveForeground`,
          label: "Destructive Foreground",
          type: "color",
        },
      ],
    },
    {
      group: "Muted Colors",
      fields: [
        { field: `${mode}.muted`, label: "Muted", type: "color" },
        {
          field: `${mode}.mutedForeground`,
          label: "Muted Foreground",
          type: "color",
        },
      ],
    },
    {
      group: "Border Colors",
      fields: [
        { field: `${mode}.border`, label: "Border", type: "color" },
        { field: `${mode}.input`, label: "Input", type: "color" },
        { field: `${mode}.ring`, label: "Ring", type: "color" },
      ],
    },
    {
      group: "Chart Colors",
      fields: [
        { field: `${mode}.chart1`, label: "Chart 1", type: "color" },
        { field: `${mode}.chart2`, label: "Chart 2", type: "color" },
        { field: `${mode}.chart3`, label: "Chart 3", type: "color" },
        { field: `${mode}.chart4`, label: "Chart 4", type: "color" },
        { field: `${mode}.chart5`, label: "Chart 5", type: "color" },
      ],
    },
    {
      group: "Sidebar Colors",
      fields: [
        { field: `${mode}.sidebar`, label: "Sidebar", type: "color" },
        {
          field: `${mode}.sidebarForeground`,
          label: "Sidebar Foreground",
          type: "color",
        },
        {
          field: `${mode}.sidebarPrimary`,
          label: "Sidebar Primary",
          type: "color",
        },
        {
          field: `${mode}.sidebarPrimaryForeground`,
          label: "Sidebar Primary Foreground",
          type: "color",
        },
        {
          field: `${mode}.sidebarAccent`,
          label: "Sidebar Accent",
          type: "color",
        },
        {
          field: `${mode}.sidebarAccentForeground`,
          label: "Sidebar Accent Foreground",
          type: "color",
        },
        {
          field: `${mode}.sidebarBorder`,
          label: "Sidebar Border",
          type: "color",
        },
        { field: `${mode}.sidebarRing`, label: "Sidebar Ring", type: "color" },
      ],
    },
  ];

  return (
    <Accordion
      type="multiple"
      className="flex flex-col gap-2"
      defaultValue={[
        "Radius",
        "Primary Colors",
        "Secondary Colors",
        "Base Colors",
        "Card Colors",
        "Popover Colors",
        "Destructive Colors",
        "Accent Colors",
        "Muted Colors",
        "Border Colors",
        "Chart Colors",
        "Sidebar Colors",
      ]}
    >
      {themeGroups.map(({ group, fields }) => (
        <AccordionItem
          key={group}
          value={group}
          className="rounded-md border px-3 last:border"
        >
          <AccordionTrigger className="py-3">{group}</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2">
            {fields.map(({ field, label, type }) => {
              if (type === "color") {
                return (
                  <ColorField
                    key={field}
                    field={field as ThemeFieldPath}
                    label={label}
                    form={form}
                  />
                );
              }

              return <RadiusField key={field} mode={mode} form={form} />;
            })}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
