// tailwind config is required for editor support

import tailwindConfig from "@repo/ui/tailwind-config";

import type { Config } from "tailwindcss";

const config: Pick<Config, "content" | "presets" | "theme"> = {
  content: ["./src/**/*.tsx"],
  presets: [tailwindConfig],
};

export default config;
