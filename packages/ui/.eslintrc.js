// This configuration only applies to the package manager root.
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-config/react-internal.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/naming-convention": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    "@typescript-eslint/no-shadow": "off",
    "func-names": "off",
    "jsx-a11y/anchor-has-content": "off",
    "jsx-a11y/heading-has-content": "off",
    "react/jsx-key": "off",
    "react/no-unknown-property": "off",
    "react/no-unstable-nested-components": "off",
  },
  ignorePatterns: ["tailwind.config.ts", "postcss.config.js"],
};
