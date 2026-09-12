import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["src/js/vendor/**"],
  },
  js.configs.recommended,
  {
    files: ["src/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
  },
];
