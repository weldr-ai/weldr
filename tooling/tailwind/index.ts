import type { Config } from "tailwindcss";
import aspectRatio from "@tailwindcss/aspect-ratio";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";
import animate from "tailwindcss-animate";
import { createPlugin } from "windy-radix-palette";
import windyTypography from "windy-radix-typography";

const colors = createPlugin();

export default {
  darkMode: ["class"],
  content: ["src/**/*.{ts,tsx}"],
  presets: [windyTypography],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: colors.alias("slate.1"),
        "subtle-background": colors.alias("slate.2"),
        foreground: colors.alias("slate.12"),
        "subtle-foreground": colors.alias("slate.11"),

        muted: {
          DEFAULT: colors.alias("slate.2"),
          foreground: colors.alias("slate.11"),
        },

        accent: {
          DEFAULT: colors.alias("slate.4"),
          foreground: colors.alias("slate.12"),
        },

        card: {
          DEFAULT: colors.alias({
            light: "slate.1",
            dark: "slate.2",
          }),
          foreground: colors.alias("slate.12"),
        },

        popover: {
          DEFAULT: colors.alias({
            light: "slate.1",
            dark: "slate.2",
          }),
          foreground: colors.alias("slate.12"),
        },

        input: colors.alias("slate.7"),
        border: colors.alias("slate.7"),
        ring: colors.alias("indigo.7"),

        slate: {
          1: colors.alias("slate.1"),
          2: colors.alias("slate.2"),
          3: colors.alias("slate.3"),
          4: colors.alias("slate.4"),
          5: colors.alias("slate.5"),
          6: colors.alias("slate.6"),
          7: colors.alias("slate.7"),
          8: colors.alias("slate.8"),
          9: colors.alias("slate.9"),
          10: colors.alias("slate.10"),
          11: colors.alias("slate.11"),
          12: colors.alias("slate.12"),
        },

        primary: {
          DEFAULT: colors.alias("indigo.9"),
          foreground: colors.alias("indigo.12"),
          1: colors.alias("indigo.1"),
          2: colors.alias("indigo.2"),
          3: colors.alias("indigo.3"),
          4: colors.alias("indigo.4"),
          5: colors.alias("indigo.5"),
          6: colors.alias("indigo.6"),
          7: colors.alias("indigo.7"),
          8: colors.alias("indigo.8"),
          9: colors.alias("indigo.9"),
          10: colors.alias("indigo.10"),
          11: colors.alias("indigo.11"),
          12: colors.alias("indigo.12"),
        },

        secondary: {
          DEFAULT: colors.alias("mint.9"),
          foreground: colors.alias("mint.1"),
          1: colors.alias("mint.1"),
          2: colors.alias("mint.2"),
          3: colors.alias("mint.3"),
          4: colors.alias("mint.4"),
          5: colors.alias("mint.5"),
          6: colors.alias("mint.6"),
          7: colors.alias("mint.7"),
          8: colors.alias("mint.8"),
          9: colors.alias("mint.9"),
          10: colors.alias("mint.10"),
          11: colors.alias("mint.11"),
          12: colors.alias("mint.12"),
        },

        destructive: {
          DEFAULT: colors.alias("ruby.9"),
          foreground: colors.alias("ruby.12"),
          1: colors.alias("ruby.1"),
          2: colors.alias("ruby.2"),
          3: colors.alias("ruby.3"),
          4: colors.alias("ruby.4"),
          5: colors.alias("ruby.5"),
          6: colors.alias("ruby.6"),
          7: colors.alias("ruby.7"),
          8: colors.alias("ruby.8"),
          9: colors.alias("ruby.9"),
          10: colors.alias("ruby.10"),
          11: colors.alias("ruby.11"),
          12: colors.alias("ruby.12"),
        },

        warning: {
          DEFAULT: colors.alias("yellow.9"),
          foreground: colors.alias("yellow.12"),
          1: colors.alias("yellow.1"),
          2: colors.alias("yellow.2"),
          3: colors.alias("yellow.3"),
          4: colors.alias("yellow.4"),
          5: colors.alias("yellow.5"),
          6: colors.alias("yellow.6"),
          7: colors.alias("yellow.7"),
          8: colors.alias("yellow.8"),
          9: colors.alias("yellow.9"),
          10: colors.alias("yellow.10"),
          11: colors.alias("yellow.11"),
          12: colors.alias("yellow.12"),
        },

        success: {
          DEFAULT: colors.alias("jade.9"),
          foreground: colors.alias("jade.12"),
          1: colors.alias("jade.1"),
          2: colors.alias("jade.2"),
          3: colors.alias("jade.3"),
          4: colors.alias("jade.4"),
          5: colors.alias("jade.5"),
          6: colors.alias("jade.6"),
          7: colors.alias("jade.7"),
          8: colors.alias("jade.8"),
          9: colors.alias("jade.9"),
          10: colors.alias("jade.10"),
          11: colors.alias("jade.11"),
          12: colors.alias("jade.12"),
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate, aspectRatio, forms, typography, colors.plugin],
} satisfies Config;
