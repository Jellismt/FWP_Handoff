/**
 * @file eslint.config.js
 * @module engage-mt/web
 * @description ESLint 9 flat-config — migrated from `.eslintrc.cjs` per
 *. Preserves the rule
 *              contracts verbatim (`no-console`, the inline-style
 * `no-restricted-syntax` ban, target-blank rel,
 *              `no-explicit-any`).
 *
 *              Flat config differs from the legacy `.eslintrc.cjs` in
 *              three ways the team should know:
 *                1. Plugins are imported, not name-strings.
 *                2. There is no `extends`; instead, each config object
 *                   appears in the array in order, and later objects
 *                   override earlier ones for the matching files.
 *                3. The `overrides` array is replaced by additional
 *                   config objects with their own `files:` globs.
 *
 *              Per docs/rules/design-polish.md + docs/rules/privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-06-08
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

const INLINE_STYLE_BAN = [
  {
    selector:
      "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name='margin']",
    message:
      "Inline margin disallowed. Move into a CSS class + use --fwp-space-* tokens. Per docs/rules/design-polish.md.",
  },
  {
    selector:
      "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name='padding']",
    message:
      "Inline padding disallowed. Move into a CSS class + use --fwp-space-* tokens. Per docs/rules/design-polish.md.",
  },
  {
    selector:
      "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name='fontSize']",
    message:
      "Inline font-size disallowed. Move into a CSS class + use --fwp-text-* tokens. Per docs/rules/fwp-brand.md (9-step ramp).",
  },
];

export default [
  // ── Global ignores (replaces .eslintrc.cjs `ignorePatterns`) ──────────
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },

  // ── React version (unscoped so it reaches the recommended preset) ─────
  // Must precede reactPlugin.configs.flat.recommended below — that preset
  // resolves the React version at load time, so a `files`-scoped settings
  // block (further down) lands too late and ESLint warns "React version not
  // specified". Flat config merges `settings` across all matching objects,
  // so this unscoped entry applies everywhere including the preset.
  //
  // "18.3" is intentional under our React 19 runtime: eslint-plugin-react has
  // no dedicated React 19 mode, "18.3" is the highest version it recognizes,
  // and none of the version-gated rules we enable differ between 18.3 and 19 —
  // so this is a correct no-op, not drift. Revisit if the plugin ships a 19 mode.
  { settings: { react: { version: "18.3" } } },

  // ── Base recommended rule sets ────────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  jsxA11y.flatConfigs.recommended,

  // ── Project-wide language + plugin wiring ────────────────────────────
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // react-hooks 5 ships its rules in a flat-config-friendly shape but
      // doesn't auto-register them in flat mode — wire them here.
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react/prop-types": "off",
      // Every `target="_blank"` must carry rel="noopener
      // noreferrer" so a malicious linked page can't `window.opener` the
      // tab we navigated from. Same posture FWP's other public surfaces ship.
      "react/jsx-no-target-blank": [
        "error",
        { allowReferrer: false, enforceDynamicLinks: "always" },
      ],
      // Ban raw console.* in non-test code. Use
      // `createLogger("module")` from `@/utils/logger` instead, which
      // routes through the in-memory + persisted diagnostics buffer per
      // docs/rules/privacy.md. The two legitimate sites (the logger
      // itself + the persistedKey dev-time warning) carry inline
      // eslint-disable comments and are exempt.
      "no-console": "error",
      // DATA-LAZY — these src/data content modules are the
      // BUILD SOURCE OF TRUTH only: `npm run build:data` emits each as a
      // /data/*.json Tier-2 dataset the app fetches lazily (per
      // docs/rules/data-layer.md). A value-import from app code re-bakes
      // hundreds of lines of curated prose into the bundle — exactly the
      // regression this migration removed. Type imports stay legal
      // (allowTypeImports); tests are exempted in the override below.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: ["@/data/waterbodyNarratives", "@/data/trails"].map((name) => ({
            name,
            message:
              "Build-source-only content module — fetch its /data/*.json at runtime instead (DATA-LAZY, docs/rules/data-layer.md). Type imports are allowed.",
            allowTypeImports: true,
          })),
        },
      ],
    },
  },

  // ── DATA-LAZY override: tests may import build-source content ─────────
  // Unit tests may exercise the curated rows directly (they don't ship in
  // the bundle), so the restriction is lifted for test files.
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": "off",
    },
  },

  // ── Override 1: component+helper hybrid surfaces ──────────────────────
  // Feature-card renderers intentionally side-effect-register and don't
  // need HMR friendliness for their internal component closures.
  // Shared chart primitives co-locate a small typed constant with their
  // component for one-import ergonomics; splitting them into a sibling
  // file would just move the same code for no Fast-Refresh win.
  {
    files: [
      "src/components/map/featureCards/cards/*Card.tsx",
      "src/components/map/featureCards/core/*Card.tsx",
      "src/components/map/featureCards/takeovers/*.tsx",
      "src/components/shared/charts/*.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },

  // ── Override 2: inline-style ban (TSX only) ───────────────────────────
  // Ban inline `style={{}}` to prevent token-bypass
  // drift. Two narrow exceptions per docs/rules/design-polish.md:
  //   (1) the CSS-custom-property-setter pattern (`style={{ "--token":
  //       value } as CSSProperties}`) is allowed since it's how we bridge
  //       dynamic data to token-driven CSS, and
  //   (2) inline charts / SVG primitives where percentage positioning is
  //       genuinely dynamic.
  // Both are surfaced via the `style` attribute, so we can't ban the
  // attribute outright — instead the rule below catches accidental
  // hardcoded px / hex / margin sites. New violations should refactor
  // into a CSS class or a CSS custom property.
  //
  // Catches: style attributes whose value contains a margin, padding, or
  // fontSize property. Misses: template strings + dynamic values
  // (intentional — those are the legitimate cases).
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["warn", ...INLINE_STYLE_BAN],
    },
  },

  // ── Override 3: console-allowed surfaces ──────────────────────────────
  // Test files + the logger + the persistedKey dev warning are exempt
  // from no-console.
  {
    files: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/utils/logger.ts",
      "src/store/persistedKey.ts",
      "tests/**/*.ts",
      "tests/**/*.tsx",
      "scripts/**/*.{mjs,js,ts}",
    ],
    rules: {
      "no-console": "off",
    },
  },

  // ── Override 4: Node-environment files (scripts, config files) ────────
  // `scripts/*.mjs` + `*.config.cjs/js` run on Node, not in the browser.
  // They legitimately use console/process/module/URL globals.
  {
    files: ["scripts/**/*.{mjs,js,cjs}", "*.config.{js,cjs,mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "module",
    },
    rules: {
      "no-undef": "off", // node script files; globals are defined above
    },
  },

  // ── Prettier conflict-suppression — must be last ──────────────────────
  prettier,
];
