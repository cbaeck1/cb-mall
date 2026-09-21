// PRD 8.48/8.66절: react/no-danger을 error로 강제(8.66절 O-5, 8.61절 J-5 XSS 방지)
import base from "./base.js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  ...base,
  {
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/no-danger": "error",
      "react/react-in-jsx-scope": "off",
    },
  },
];
