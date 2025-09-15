import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/dist/", "**/node_modules/", "**/coverage/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended,
];
