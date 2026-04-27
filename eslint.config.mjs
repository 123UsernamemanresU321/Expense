import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This app intentionally fetches Supabase client data from effects.
      // The rule flags normal loading-state transitions as errors.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["test-*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "run_sql.js",
    "test-*.js",
  ]),
]);

export default eslintConfig;
