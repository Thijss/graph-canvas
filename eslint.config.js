import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["js/vendor/**"],
  },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
  },
];
