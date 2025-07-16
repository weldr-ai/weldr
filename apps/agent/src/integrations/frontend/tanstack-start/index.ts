import {
  directoryExists,
  renameDirectory,
  replaceTextInFiles,
} from "@/integrations/utils/file-system";
import { defineIntegration } from "@/integrations/utils/integration-core";

export const tanstackStartIntegration = await defineIntegration({
  category: "frontend",
  key: "tanstack-start",
  name: "Tanstack Start",
  description:
    "Modern React framework that provides server-side rendering, routing, and data fetching for building high-performance web applications.",
  version: "1.0.0",
  allowMultiple: false,
  dependencies: null,
  options: null,
  variables: null,
  scripts: {
    dev: "vite dev",
    build: "vite build",
    start: "node .output/server/index.mjs",
    typecheck: "tsc --noEmit",
    check: "biome check --diagnostic-level=warn",
    "check:fix": "biome check --diagnostic-level=warn --write",
    clean: "rm -rf node_modules .output .nitro .vinxi",
  },
  packages: {
    add: {
      runtime: {
        "@hookform/resolvers": "^5.1.1",
        "@tanstack/react-query": "^5.82.0",
        "@tanstack/react-router": "^1.125.6",
        "@tanstack/react-router-with-query": "^1.125.6",
        "@tanstack/react-start": "^1.126.1",
        "class-variance-authority": "^0.7.1",
        clsx: "^2.1.1",
        cmdk: "^1.1.1",
        "date-fns": "^4.1.0",
        "embla-carousel-react": "^8.6.0",
        "input-otp": "^1.4.2",
        "lucide-react": "^0.525.0",
        "next-themes": "^0.4.6",
        "radix-ui": "^1.4.2",
        react: "^19.1.0",
        "react-day-picker": "^9.8.0",
        "react-dom": "^19.1.0",
        "react-hook-form": "^7.60.0",
        "react-resizable-panels": "^3.0.3",
        recharts: "^3.1.0",
        sonner: "^2.0.6",
        "tailwind-merge": "^3.3.1",
        tailwindcss: "^4.1.11",
        "tw-animate-css": "^1.3.5",
        vaul: "^1.1.2",
        zod: "^3.25.49",
      },
      development: {
        "@biomejs/biome": "2.1.1",
        "@tailwindcss/vite": "^4.1.11",
        "@types/react": "^19.1.8",
        "@types/react-dom": "^19.1.6",
        "@vitejs/plugin-react": "^4.6.0",
        vite: "^7.0.3",
        "vite-tsconfig-paths": "^5.1.4",
      },
    },
    remove: ["tsx", "esbuild"],
  },
  dirMap: {
    "standalone-frontend": {
      web: "src",
      "config/shared/*": ".",
      "config/standalone/*": ".",
    },
    "full-stack": {
      web: "web",
      "config/shared/*": ".",
      "config/full-stack/*": ".",
    },
  },
  preInstall: async () => {
    // Handle src -> server directory rename
    const hasSrcDir = await directoryExists("src");
    if (hasSrcDir) {
      const renamed = await renameDirectory("src", "server");
      if (!renamed) {
        return {
          success: false,
          message: "Failed to rename src directory to server",
          errors: ["Could not rename src directory to server"],
        };
      }
    }

    // Replace @/ with @server/ in all files
    const replaced = await replaceTextInFiles("@/", "@server/");
    if (!replaced) {
      return {
        success: false,
        message: "Failed to replace @/ with @server/",
        errors: ["Could not replace import paths"],
      };
    }

    return {
      success: true,
      message: "Successfully ran frontend integration pre-install hook",
    };
  },
});
