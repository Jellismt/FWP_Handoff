/**
 * @file ManagePage.tsx
 * @module engage-mt/manage
 * @description "My FWP" — the whole module on one simple page: a "Log in to
 *              My FWP" button (inert seam — real FWP authentication is a
 *              documented future integration, STUB-001), a plain listing of
 *              the licenses / tags / permits the signed-in user owns, and the
 *              two device cards (My Device, Field tools).
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-16
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Smartphone } from "lucide-react";
import { isCapacitor } from "@/utils/capacitor";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { SIGN_IN_COMING_SOON } from "@/copy/signInComingSoon";
import { PillButton } from "@/components/shared/forms/PillButton";
import { ListCard } from "@/components/shared/widgets/ListCard";
import { ManageCard } from "./ManageCard";
import "./ManagePage.css";

export const ManagePage = (): JSX.Element => {
  const { wallet } = useWallet();
  const { show } = useToast();

  return (
    <section className="manage-page fwp-mobile-safe-bottom" data-module="manage">
      <div className="fwp-tool-hero" data-module="manage">
        <Link to="/" className="fwp-tool-hero__map-cta">
          <span>View map</span>
          <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
        </Link>
        <h1 className="fwp-tool-hero__title">My FWP</h1>
        <p className="fwp-tool-hero__lede">
          The licenses and tags you own, plus this device&rsquo;s data and field tools.
        </p>
        <div className="manage-wallet__signin-cta">
          <PillButton variant="primary" onClick={() => show(SIGN_IN_COMING_SOON)}>
            Log in to My FWP
          </PillButton>
        </div>
      </div>

      {wallet && (
        <>
          <section className="manage-wallet__group" aria-labelledby="wallet-licenses">
            <h2 id="wallet-licenses">Licenses ({wallet.licenses.length})</h2>
            <div className="manage-page__list">
              {wallet.licenses.map((l) => (
                <ListCard
                  key={l.id}
                  module="manage"
                  eyebrow={`#${l.number}`}
                  title={l.type}
                  meta={[
                    { label: "Valid from", value: l.validFrom },
                    { label: "Valid to", value: l.validTo },
                  ]}
                />
              ))}
            </div>
          </section>

          <section className="manage-wallet__group" aria-labelledby="wallet-tags">
            <h2 id="wallet-tags">Tags ({wallet.etags.length})</h2>
            <div className="manage-page__list">
              {wallet.etags.map((e) => (
                <ListCard
                  key={e.id}
                  module="manage"
                  eyebrow={`District ${e.district} · Region ${e.region}`}
                  title={e.species}
                />
              ))}
            </div>
          </section>

          <section className="manage-wallet__group" aria-labelledby="wallet-permits">
            <h2 id="wallet-permits">Permits ({wallet.permits.length})</h2>
            <div className="manage-page__list">
              {wallet.permits.map((p) => (
                <ListCard
                  key={p.id}
                  module="manage"
                  eyebrow={`#${p.number}`}
                  title={p.type}
                  meta={[
                    { label: "Valid from", value: p.validFrom },
                    { label: "Valid to", value: p.validTo },
                  ]}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <section className="manage-page__device" aria-labelledby="manage-device-h">
        <h2 id="manage-device-h" className="fwp-sr-only">
          This device
        </h2>
        <ul className="fwp-manage-card-grid">
          {/* My Device is a mobile-app surface (the on-device data catalog). */}
          {isCapacitor() && (
            <li>
              <ManageCard
                to="/manage/my-device"
                title="My Device"
                description="Saved waypoints, tracks, and other on-device data."
                icon={Smartphone}
              />
            </li>
          )}
          <li>
            <ManageCard
              to="/field"
              title="Field tools"
              description="Waypoints, draw, measure, route, and photo notes — all on this device."
            />
          </li>
        </ul>
      </section>
    </section>
  );
};
