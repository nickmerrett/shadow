import baseConfig from "./base.js";

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
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
];
