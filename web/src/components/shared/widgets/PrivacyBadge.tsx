/**
 * @file PrivacyBadge.tsx
 * @module engage-mt/shared
 * @description Small "🔒 Local-only" pill that any location-using surface should
 *              surface to communicate Engage MT's local-first data posture.
 *
 * + docs/rules/privacy.md, every
 *              feature that reads device GPS or writes spatial state should
 *              expose this badge so users see the "no telemetry" stance plainly.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Lock } from "lucide-react";
import { TOOLTIPS } from "@/copy/tooltips";
import "./PrivacyBadge.css";

interface Props {
  /** Override the default copy if the surface needs a custom phrasing. */
  label?: string;
  /** Size variant. */
  size?: "sm" | "md";
  /** Optional tooltip / accessible description. */
  title?: string;
}

export const PrivacyBadge = ({ label, size = "sm", title }: Props): JSX.Element => (
  <span
    className={`privacy-badge privacy-badge--${size}`}
    title={title ?? TOOLTIPS.privacyLocalOnly}
  >
    <Lock size={size === "md" ? 14 : 11} strokeWidth={2.5} aria-hidden />
    <span>{label ?? "Local-only"}</span>
  </span>
);
