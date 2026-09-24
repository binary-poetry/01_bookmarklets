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
    // bookmarklets run on other people's pages, under their CSP and Trusted
    // Types: build the DOM with h(), style it via mount()
    files: ["bookmarklets/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name=/^(inner|outer)HTML$/]",
          message:
            "Trusted Types (YouTube and others) reject HTML strings. Build the DOM with h()."
        },
        {
          selector:
            "CallExpression[callee.property.name='insertAdjacentHTML'], CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/], MemberExpression[property.name='srcdoc']",
          message:
            "Trusted Types (YouTube and others) reject HTML strings. Build the DOM with h()."
        },
        {
          selector:
            "CallExpression[callee.name='eval'], NewExpression[callee.name='Function'], CallExpression[callee.name=/^set(Timeout|Interval)$/][arguments.0.type=/^(Literal|TemplateLiteral)$/]",
          message:
            "Page CSPs without 'unsafe-eval' block code from strings. Pass a function."
        },
        {
          selector:
            "CallExpression[callee.property.name='createElement'][arguments.0.value='style'], CallExpression[callee.name='h'][arguments.0.value='style'], CallExpression[callee.property.name='setAttribute'][arguments.0.value='style']",
          message:
            "A page's style-src blocks <style> elements and style attributes. Use mount()'s adopted stylesheets, or assign element.style."
        }
      ]
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
