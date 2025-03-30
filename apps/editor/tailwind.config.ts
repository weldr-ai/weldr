import type { Config } from "tailwindcss";

import baseConfig from "@weldr/tailwind-config";

const config: Pick<Config, "content" | "presets" | "theme" | "important"> = {
  important: true,
  content: ["./src/**/*.tsx", "../../packages/ui/**/*.{ts,tsx}"],
  presets: [baseConfig],
  theme: {
    extend: {
      backgroundImage: {
        "glow-conic":
          "conic-gradient(from 180deg at 50% 50%, #3E63DD 0deg, #3E63DD 180deg, #3E63DD 360deg)",
      },
      animation: {
        shine: "shine 2s linear infinite",
      },
      keyframes: {
        shine: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "0 0" },
        },
      },
    },
  },
};

export default config;
