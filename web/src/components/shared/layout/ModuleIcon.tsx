/**
 * @file ModuleIcon.tsx
 * @module engage-mt/shared
 * @description Renders a lucide-react icon for a given module nav entry. Falls back
 *              to a small text label if the icon name doesn't resolve.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Target, Fish, TreePine, Map as MapIcon, IdCard, type LucideIcon } from "lucide-react";

const ICON_BY_NAME: Record<string, LucideIcon> = {
  target: Target,
  fish: Fish,
  "tree-pine": TreePine,
  map: MapIcon,
  "id-card": IdCard,
};

interface Props {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const ModuleIcon = ({
  name,
  size = 22,
  strokeWidth = 1.75,
  className,
}: Props): JSX.Element => {
  const Icon = ICON_BY_NAME[name];
  if (!Icon) {
    return (
      <span className={className} aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
};
