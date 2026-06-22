import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  URL: "readonly",
  AbortController: "readonly",
  fetch: "readonly"
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "node_modules/**",
      "coverage/**",
      "examples/**/node_modules/**",
      "packages/cli/bin/**"
    ]
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: nodeGlobals
    },
    rules:{
      "no-useless-escape": "off"
    }
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: nodeGlobals
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
);
