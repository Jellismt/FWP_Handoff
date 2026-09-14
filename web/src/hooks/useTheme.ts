/**
 * @file useTheme.ts
 * @module engage-mt/hooks
 * @description React hook that returns the resolved theme + a setter and keeps:
 *               (a) the document attribute `data-color-scheme` in sync,
 *               (b) Calcite's mode (light/dark class on <html>),
 *               (c) the ArcGIS SDK theme stylesheet swapped to match.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import { version as ARCGIS_VERSION } from "@arcgis/core/kernel";
import { useThemeStore, type ResolvedTheme, type ThemePreference } from "@/store/app/themeStore";

export interface UseThemeReturn {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

// Template via @arcgis/core's bundled version so the theme CSS host
// auto-tracks SDK bumps (the build stamps the same value into index.html).
const ARCGIS_MAJOR_MINOR = ARCGIS_VERSION.split(".").slice(0, 2).join(".");
const ARCGIS_THEME_BASE = `https://js.arcgis.com/${ARCGIS_MAJOR_MINOR}/@arcgis/core/assets/esri/themes`;

const setArcgisTheme = (resolved: ResolvedTheme): void => {
  const link = document.getElementById("arcgis-theme") as HTMLLinkElement | null;
  if (link) link.href = `${ARCGIS_THEME_BASE}/${resolved}/main.css`;
};

const setCalciteMode = (resolved: ResolvedTheme): void => {
  const root = document.documentElement;
  root.classList.toggle("calcite-mode-dark", resolved === "dark");
  root.classList.toggle("calcite-mode-light", resolved === "light");
};

export const useTheme = (): UseThemeReturn => {
  const preference = useThemeStore((s) => s.preference);
  const resolved = useThemeStore((s) => s.resolved);
  const setPreference = useThemeStore((s) => s.setPreference);

  // Reflect resolved theme on <html> so brand tokens, Calcite mode, and ArcGIS theme all swap together.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-color-scheme", resolved);
    root.style.colorScheme = resolved;
    setCalciteMode(resolved);
    setArcgisTheme(resolved);
  }, [resolved]);

  // Watch system preference when user picked "system".
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return undefined;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => {
      setPreference("system");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [preference, setPreference]);

  return { preference, resolved, setPreference };
};
