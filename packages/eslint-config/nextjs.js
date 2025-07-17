import baseConfig from "./base.js";
import globals from "globals";

export default [
  ...baseConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: "readonly",
        console: "readonly",
        process: "readonly",
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        ...globals.browser,
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
];
