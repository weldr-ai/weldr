import type { Theme, ThemeMode } from "@weldr/shared/types";
import type { UseFormReturn } from "react-hook-form";

export function ThemeWrapper({
  mode,
  form,
  children,
}: {
  mode: ThemeMode;
  form: UseFormReturn<Theme>;
  children: React.ReactNode;
}) {
  return (
    <div
      data-theme={mode}
      style={
        {
          "--background": `${form.watch(`${mode}.background`)}`,
          "--foreground": `${form.watch(`${mode}.foreground`)}`,
          "--primary": `${form.watch(`${mode}.primary`)}`,
          "--primary-foreground": `${form.watch(`${mode}.primaryForeground`)}`,
          "--secondary": `${form.watch(`${mode}.secondary`)}`,
          "--secondary-foreground": `${form.watch(`${mode}.secondaryForeground`)}`,
          "--destructive": `${form.watch(`${mode}.destructive`)}`,
          "--destructive-foreground": `${form.watch(`${mode}.destructiveForeground`)}`,
          "--card": `${form.watch(`${mode}.card`)}`,
          "--card-foreground": `${form.watch(`${mode}.cardForeground`)}`,
          "--popover": `${form.watch(`${mode}.popover`)}`,
          "--popover-foreground": `${form.watch(`${mode}.popoverForeground`)}`,
          "--accent": `${form.watch(`${mode}.accent`)}`,
          "--accent-foreground": `${form.watch(`${mode}.accentForeground`)}`,
          "--muted": `${form.watch(`${mode}.muted`)}`,
          "--muted-foreground": `${form.watch(`${mode}.mutedForeground`)}`,
          "--border": `${form.watch(`${mode}.border`)}`,
          "--input": `${form.watch(`${mode}.input`)}`,
          "--ring": `${form.watch(`${mode}.ring`)}`,
          "--radius": `${form.watch(`${mode}.radius`)}rem`,
          "--chart-1": `${form.watch(`${mode}.chart1`)}`,
          "--chart-2": `${form.watch(`${mode}.chart2`)}`,
          "--chart-3": `${form.watch(`${mode}.chart3`)}`,
          "--chart-4": `${form.watch(`${mode}.chart4`)}`,
          "--chart-5": `${form.watch(`${mode}.chart5`)}`,
          "--sidebar": `${form.watch(`${mode}.sidebar`)}`,
          "--sidebar-foreground": `${form.watch(`${mode}.sidebarForeground`)}`,
          "--sidebar-primary": `${form.watch(`${mode}.sidebarPrimary`)}`,
          "--sidebar-primary-foreground": `${form.watch(`${mode}.sidebarPrimaryForeground`)}`,
          "--sidebar-accent": `${form.watch(`${mode}.sidebarAccent`)}`,
          "--sidebar-accent-foreground": `${form.watch(`${mode}.sidebarAccentForeground`)}`,
          "--sidebar-border": `${form.watch(`${mode}.sidebarBorder`)}`,
          "--sidebar-ring": `${form.watch(`${mode}.sidebarRing`)}`,
        } as React.CSSProperties
      }
      className="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-transparent h-[calc(100vh-204px)] min-h-full overflow-y-auto rounded-md bg-background text-foreground"
    >
      {children}
    </div>
  );
}
