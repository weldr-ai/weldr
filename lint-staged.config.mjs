const buildEslintCommand = () => "pnpm lint:fix";
const buildPrettierCommand = () => "pnpm format:fix";

export default {
  "*.{js,cjs,mjs,jsx,ts,tsx}": [buildEslintCommand],
  "*.{js,cjs,mjs,jsx,ts,tsx,json,md,mdx}": [buildPrettierCommand],
};
