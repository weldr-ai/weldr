import type { Config } from "tailwindcss";

import baseConfig from "@integramind/tailwind-config";

const config: Pick<Config, "content" | "presets" | "theme"> = {
  content: ["./src/**/*.tsx", "../../packages/ui/**/*.{ts,tsx}"],
  presets: [baseConfig],
  theme: {
    extend: {
      backgroundImage: {
        "glow-conic":
          "conic-gradient(from 180deg at 50% 50%, #3E63DD 0deg, #3E63DD 180deg, #3E63DD 360deg)",
      },
    },
  },
};

export default config;
