import { z } from "zod";

export const themeDataSchema = z.object({
  background: z.string().min(1),
  foreground: z.string().min(1),

  primary: z.string().min(1),
  primaryForeground: z.string().min(1),

  secondary: z.string().min(1),
  secondaryForeground: z.string().min(1),

  destructive: z.string().min(1),
  destructiveForeground: z.string().min(1),

  card: z.string().min(1),
  cardForeground: z.string().min(1),

  popover: z.string().min(1),
  popoverForeground: z.string().min(1),

  accent: z.string().min(1),
  accentForeground: z.string().min(1),

  muted: z.string().min(1),
  mutedForeground: z.string().min(1),

  border: z.string().min(1),
  input: z.string().min(1),
  ring: z.string().min(1),

  radius: z.number().min(0),

  chart1: z.string().min(1),
  chart2: z.string().min(1),
  chart3: z.string().min(1),
  chart4: z.string().min(1),
  chart5: z.string().min(1),

  sidebar: z.string().min(1),
  sidebarForeground: z.string().min(1),
  sidebarPrimary: z.string().min(1),
  sidebarPrimaryForeground: z.string().min(1),
  sidebarAccent: z.string().min(1),
  sidebarAccentForeground: z.string().min(1),
  sidebarBorder: z.string().min(1),
  sidebarRing: z.string().min(1),
});

export const themeSchema = z.object({
  light: themeDataSchema,
  dark: themeDataSchema,
});
