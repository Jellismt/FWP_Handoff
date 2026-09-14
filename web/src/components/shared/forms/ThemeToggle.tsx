/**
 * @file ThemeToggle.tsx
 * @module engage-mt/shared
 * @description Icon-only theme toggle. Boots in "system" (auto) so the app follows the
 *              user's OS preference on first load. The button renders the
 *              icon for the *resolved* theme — sun in light, moon in dark — with no
 *              text label. Clicking sets the preference to the explicit opposite of
 *              the currently-resolved theme; subsequent clicks toggle light ↔ dark.
 *              "system" is only the initial state, never returned to after a click —
 *              matches the simpler two-state UX the user picked over a tri-state cycle.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export const ThemeToggle = (): JSX.Element => {
  const { resolved, setPreference } = useTheme();
  const isLight = resolved === "light";
  const Icon = isLight ? Sun : Moon;
  const nextLabel = isLight ? "dark" : "light";
  return (
    <button
      type="button"
      className="fwp-pill-button fwp-pill-button--on-brand app-header__theme"
      onClick={() => setPreference(isLight ? "dark" : "light")}
      aria-label={`Switch to ${nextLabel} mode`}
      title={`Switch to ${nextLabel} mode`}
    >
      <Icon size={16} strokeWidth={2} aria-hidden />
    </button>
  );
};
