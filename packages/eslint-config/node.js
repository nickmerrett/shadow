import baseConfig from "./base.js";
import globals from "globals";

export default [
  ...baseConfig,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        fetch: "false",
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
