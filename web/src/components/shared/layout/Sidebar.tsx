/**
 * @file Sidebar.tsx
 * @module engage-mt/shared
 * @description Persistent left-rail module switcher shown on viewports ≥ 1024px.
 *              Mirrors BottomTabBar for narrow viewports.
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
import "./Sidebar.css";

export const Sidebar = (): JSX.Element => {
  const { pathname } = useLocation();
  return (
    <nav className="sidebar" aria-label="Modules">
      <ul className="sidebar__list">
        {MODULE_NAV.map((item) => {
          // Merged tabs (Explore & Access) also light up on their alt prefixes.
          const altActive = item.altPathPrefixes?.some((p) => pathname.startsWith(p)) ?? false;
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar__link${isActive || altActive ? " sidebar__link--active" : ""}`
                }
                data-module={item.module}
                end={item.path === "/"}
                {...prefetchProps(item.path)}
              >
                <ModuleIcon name={item.glyph} className="sidebar__icon" />
                <span className="sidebar__label">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
