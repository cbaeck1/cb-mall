// PRD 8.48절: ESLint 최신(flat config), 모노레포 공유(base/next/nestjs), 포맷팅은 Prettier가 전담
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  prettier,
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", "coverage/**", "*.config.*"],
  },
);
