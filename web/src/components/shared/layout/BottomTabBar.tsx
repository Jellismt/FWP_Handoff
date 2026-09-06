/**
 * @file BottomTabBar.tsx
 * @module engage-mt/shared
 * @description Mobile-first bottom tab bar (≤ 1023px). 44px touch targets.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { NavLink, useLocation } from "react-router-dom";
import { MODULE_NAV } from "@/config/navigation";
import { ModuleIcon } from "@/components/shared/layout/ModuleIcon";
import { prefetchProps } from "@/utils/routePrefetch";
import "./BottomTabBar.css";

export const BottomTabBar = (): JSX.Element => {
  const { pathname } = useLocation();
  return (
    <nav className="bottom-tab-bar" aria-label="Modules">
      <ul className="bottom-tab-bar__list">
        {MODULE_NAV.map((item) => {
          // Merged tabs (Explore & Access) also light up on their alt prefixes.
          const altActive = item.altPathPrefixes?.some((p) => pathname.startsWith(p)) ?? false;
          return (
            <li key={item.path} className="bottom-tab-bar__item">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `bottom-tab-bar__link${isActive || altActive ? " bottom-tab-bar__link--active" : ""}`
                }
                data-module={item.module}
                end={item.path === "/"}
                {...prefetchProps(item.path)}
              >
                <ModuleIcon name={item.glyph} className="bottom-tab-bar__icon" />
                <span className="bottom-tab-bar__label">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
