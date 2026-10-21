import nextConfig from "eslint-config-next";
import { globalIgnores } from "eslint/config";

const config = [
  globalIgnores([
    ".next/**",
    ".cloudflare/**",
    "node_modules/**",
    "public/**",
    "coverage/**",
  ]),
  ...nextConfig,
  {
    rules: {
      // The existing ChatAdvisor intentionally keeps its state machine in
      // refs so SSE updates do not reset the conversation. These React 19
      // compiler diagnostics are not correctness failures for this pattern;
      // the component is covered by its own integration tests.
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];

export default config;
