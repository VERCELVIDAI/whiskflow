import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // These components intentionally synchronize controlled UI state with
      // external systems (localStorage, prop refreshes, dialog lifecycle).
      // The React Compiler's advisory rule is too strict for those patterns.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".data/**",
    "next-env.d.ts",
    "public/**",
    "coverage/**",
  ]),
]);
