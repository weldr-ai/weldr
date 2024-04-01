import path from "node:path";

const buildEslintCommand = () => "turbo lint -- --fix";

const buildPrettierCommand = (filenames) =>
  `prettier --write ${filenames
    .map((f) => path.relative(process.cwd(), f))
    .join(" ")}`;

export default {
  "*.{js,cjs,mjs,jsx,ts,tsx}": [buildEslintCommand],
  "*.{js,cjs,mjs,jsx,ts,tsx,json,md,mdx}": [buildPrettierCommand],
};
