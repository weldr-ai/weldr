import * as esbuild from "esbuild";
import { copy } from "esbuild-plugin-copy";

await esbuild.build({
  entryPoints: ["src/**/*.ts"],
  bundle: true,
  format: "esm",
  outdir: "dist",
  sourcemap: true,
  platform: "node",
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: [
        {
          from: ["./src/templates/*"],
          to: "./dist/templates",
        },
      ],
      watch: true,
    }),
  ],
});
