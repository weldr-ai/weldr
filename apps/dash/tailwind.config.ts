// tailwind config is required for editor support

import tailwindConfig from "@repo/ui/tailwind-config";

import type { Config } from "tailwindcss";

const config: Pick<Config, "content" | "presets" | "theme"> = {
  content: ["./src/**/*.tsx"],
  presets: [tailwindConfig],
  theme: {
    extend: {
      backgroundImage: {
        "glow-conic":
          "conic-gradient(from 180deg at 50% 50%, #2a8af6 0deg, #a853ba 180deg, #e92a67 360deg)",
      },
    },
  },
};

export default config;
