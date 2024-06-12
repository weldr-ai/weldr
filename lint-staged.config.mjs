const buildEslintCommand = () => "pnpm lint:fix";
const buildCheckTypesCommand = () => "pnpm check-types";
const buildPrettierCommand = () => "pnpm format:fix";

export default {
  "*.{js,cjs,mjs,jsx,ts,tsx}": [buildCheckTypesCommand],
  "*.{js,cjs,mjs,jsx,ts,tsx,json}": [buildEslintCommand],
  "*.{js,cjs,mjs,jsx,ts,tsx,json,md,mdx}": [buildPrettierCommand],
};
