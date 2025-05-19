const buildBiomeCommand = () => "pnpm check";
const buildCheckTypesCommand = () => "pnpm check-types";

export default {
  "*.{js,cjs,mjs,jsx,ts,tsx}": [buildCheckTypesCommand],
  "*.{js,cjs,mjs,jsx,ts,tsx,json}": [buildBiomeCommand],
};
