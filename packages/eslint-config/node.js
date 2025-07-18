import baseConfig from "./base.js";

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
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
