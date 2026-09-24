import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["node_modules/", "tests/e2e/reports/"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" }
      ],
      complexity: ["error", { max: 10, variant: "modified" }],
      "max-lines-per-function": [
        "error",
        { max: 60, skipBlankLines: true, skipComments: true }
      ]
    }
  },
  {
    // a bookmarklet is one closure over shared state: splitting `run` would
    // cost bytes and change the published hash
    files: ["bookmarklets/**"],
    rules: {
      complexity: "off",
      "max-lines-per-function": "off"
    }
  },
  {
    // describe/it wrappers are naturally long; complexity still applies
    files: ["tests/**"],
    rules: {
      "max-lines-per-function": "off"
    }
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked
  }
)
