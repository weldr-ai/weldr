import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/**/*.ts"],
  bundle: true,
  format: "esm",
  outdir: "dist",
  sourcemap: true,
  platform: "node",
});
