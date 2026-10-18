import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "error", "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] }
  },
  globalIgnores([".next/**", "node_modules/**", "coverage/**"])
]);
