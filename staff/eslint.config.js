/**
 * @file eslint.config.js
 * @module engage-mt/staff
 * @description ESLint 9 flat-config for the Regs Manager staff SPA. The workspace's
 *              `lint` script existed from day one but had no config to load (ESLint 9
 *              requires flat config), so the gate silently failed. Minimal on purpose:
 *              JS + TS recommended + react-hooks, resolving the plugins hoisted to the
 *              repo root — no new dependencies.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
