import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  { ignores: ["dist", "public"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "warn",
      "eqeqeq": ["warn", "smart"],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "warn",
      "eqeqeq": ["warn", "smart"],
      // Enforcement STYLE-GUIDE.md section 1 : "jamais de couleur hex en dur"
      // Detecte les hex dans les attributs style={} JSX. Bypass via
      //   // eslint-disable-next-line no-restricted-syntax
      // avec commentaire expliquant pourquoi (ex: brand tier, STEP_COLORS...)
      "no-restricted-syntax": [
        "warn",
        {
          "selector": "JSXAttribute[name.name='style'] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          "message": "Hex color hardcodee dans style={}. Utiliser une CSS variable (var(--...)) — voir STYLE-GUIDE.md section 1. Exceptions legitimes : ajouter // eslint-disable-next-line no-restricted-syntax avec justif (brand tier, STEP_COLORS semantiques, dark permanent non-inversible)."
        },
        {
          "selector": "JSXAttribute[name.name='style'] TemplateLiteral TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          "message": "Hex color hardcodee dans template literal style={}. Utiliser une CSS variable."
        }
      ]
    },
  },
  prettierConfig,
];
