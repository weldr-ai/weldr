module.exports = {
  root: true,
  extends: ["@repo/eslint-config/react-internal.js"],
  ignorePatterns: ["tailwind.config.ts", "postcss.config.js"],
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-shadow": "off",
    "@typescript-eslint/naming-convention": "off",
    "react/no-unstable-nested-components": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "jsx-a11y/heading-has-content": "off",
    "react/no-unknown-property": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    "jsx-a11y/anchor-has-content": "off",
    "func-names": "off",
    "no-undef": "off",
  },
};
