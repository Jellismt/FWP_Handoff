/**
 * @file WardenContactsPanel.tsx
 * @module engage-mt/shared
 * @description TipMont "Warden contacts" tab. Montana has no public per-warden
 *              directory — FWP guidance is "call your regional office" — so this
 *              surfaces the statewide TipMont hotline + a 911 note, then the
 *              seven FWP regional offices with a call action. Data from
 *              regionContacts.ts (public, no PII).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Phone } from "lucide-react";
import { ListCard } from "@/components/shared/widgets/ListCard";
import { FWP_REGIONS } from "@/services/hunt/regionContacts";
import "./WardenContactsPanel.css";

// TipMont statewide hotline. 1-800-TIP-MONT spells 1-800-847-6668.
// Verified current against FWP Enforcement 2026-07-01:
// https://fwp.mt.gov/aboutfwp/enforcement/tip-mont (reward up to $1,000).
const TIPMONT_HOTLINE = {
  display: "1-800-TIP-MONT",
  spell: "(847-6668)",
  href: "tel:+18008476668",
} as const;

export const WardenContactsPanel = (): JSX.Element => {
  return (
    <div className="warden-contacts">
      <section className="warden-contacts__hotline" aria-label="Report a violation by phone">
        <a
          className="fwp-pill-button fwp-pill-button--primary warden-contacts__call-hotline"
          href={TIPMONT_HOTLINE.href}
          aria-label={`Call the TipMont hotline, ${TIPMONT_HOTLINE.display} ${TIPMONT_HOTLINE.spell}`}
        >
          <Phone size={16} strokeWidth={2.25} aria-hidden />
          <span className="fwp-pill-button__label">
            {TIPMONT_HOTLINE.display} {TIPMONT_HOTLINE.spell}
          </span>
        </a>
      </section>

      <h3 className="warden-contacts__heading">FWP regional offices</h3>
      <p className="warden-contacts__note">
        Wardens are assigned by region. Call the office for your area and ask for the warden.
      </p>

      <div className="warden-contacts__list">
        {FWP_REGIONS.map((r) => (
          <ListCard
            key={r.region}
            module="manage"
            eyebrow={`Region ${r.region}`}
            title={`${r.name} · ${r.city}`}
            meta={[
              { label: "Phone", value: r.phone },
              { label: "Office", value: r.address },
            ]}
          />
        ))}
      </div>
    </div>
  );
};
