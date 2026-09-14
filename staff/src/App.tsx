/**
 * @file App.tsx
 * @module engage-mt/staff
 * @description Router + app shell. Resolves the session on mount; unauthenticated →
 *              login. Left nav + season-year switcher scope every screen.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import { useApp } from "./store.js";
import { LoginScreen } from "./screens/LoginScreen.js";
import { DashboardScreen } from "./screens/DashboardScreen.js";
import { DistrictBrowserScreen } from "./screens/DistrictBrowserScreen.js";
import { DistrictDetailScreen } from "./screens/DistrictDetailScreen.js";
import { ChangePasswordScreen } from "./screens/ChangePasswordScreen.js";
import { ReviewScreen } from "./screens/ReviewScreen.js";
import { LiveSnapshotScreen } from "./screens/LiveSnapshotScreen.js";
import { CorrectionsScreen } from "./screens/CorrectionsScreen.js";
import { UsersScreen } from "./screens/UsersScreen.js";
import { ContentScreen } from "./screens/ContentScreen.js";
import { FeesScreen } from "./screens/FeesScreen.js";
import { ImportantDatesScreen } from "./screens/ImportantDatesScreen.js";
import { ContactsScreen } from "./screens/ContactsScreen.js";
import { PrintScreen } from "./screens/PrintScreen.js";
import { HuntAreasScreen } from "./screens/HuntAreasScreen.js";
import { PortionsScreen } from "./screens/PortionsScreen.js";
import { RestrictedAreasScreen } from "./screens/RestrictedAreasScreen.js";
import { AssetsScreen } from "./screens/AssetsScreen.js";
import { AuditLogScreen } from "./screens/AuditLogScreen.js";
import { HowItFitsScreen } from "./screens/help/HowItFitsScreen.js";
import { GlossaryScreen } from "./screens/help/GlossaryScreen.js";
import { UserGuideScreen } from "./screens/help/guide/UserGuideScreen.js";

function Shell({ children }: { children: React.ReactNode }) {
  const { me, seasonYear, setSeasonYear, setMe, seasonYears } = useApp();
  const navigate = useNavigate();
  // Fall back to the current year while the list loads so the switcher is never empty.
  const years = seasonYears.length > 0 ? seasonYears.map((y) => y.season_year) : [seasonYear];
  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="Sections">
        <h1>FWP Regs Manager</h1>

        <div className="nav-section">Season</div>
        <NavLink to="/" end>Season dashboard</NavLink>
        <NavLink to="/live">Live snapshot</NavLink>
        <NavLink to="/review">Review &amp; publish</NavLink>
        <NavLink to="/corrections">Corrections &amp; updates</NavLink>
        <NavLink to="/print">Print export</NavLink>

        <div className="nav-section">Regulations</div>
        <NavLink to="/districts">Districts</NavLink>
        <NavLink to="/hunt-areas">Hunt areas</NavLink>
        <NavLink to="/portions">Portions</NavLink>
        <NavLink to="/restricted-areas">Restricted areas</NavLink>

        <div className="nav-section">Reference</div>
        <NavLink to="/content">Content</NavLink>
        <NavLink to="/fees">Fees</NavLink>
        <NavLink to="/important-dates">Important dates</NavLink>
        <NavLink to="/contacts">Contacts</NavLink>
        <NavLink to="/assets">Maps &amp; assets</NavLink>

        <div className="nav-section">Help</div>
        <NavLink to="/help/guide">User guide</NavLink>
        <NavLink to="/help/overview">How it fits together</NavLink>
        <NavLink to="/help/glossary">Glossary</NavLink>

        <div className="nav-section">Admin</div>
        <NavLink to="/audit">Audit log</NavLink>
        {(me?.role === "admin") && <NavLink to="/users">Users</NavLink>}

        <div className="spacer" />
        <div className="subtle" style={{ color: "#cdd7e5" }}>{me?.displayName} · {me?.role}</div>
        <NavLink to="/change-password" className="subtle" style={{ color: "#cdd7e5", fontSize: "0.8rem" }}>Change password</NavLink>
        <button
          className="secondary"
          onClick={async () => {
            await api.logout().catch(() => undefined);
            setMe(null);
            navigate("/login");
          }}
        >
          Sign out
        </button>
      </nav>
      <main className="app-main">
        <div className="topbar">
          <div className="year-select" style={{ marginLeft: "auto" }}>
            <label>Season year</label>
            <select value={seasonYear} onChange={(e) => setSeasonYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function App() {
  const { me, setMe, refreshSeasonYears } = useApp();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((rows) => {
        const identity = rows[0] ?? null;
        setMe(identity);
        // Load the season-year list once we know there's a session (drives the switcher).
        if (identity) void refreshSeasonYears().catch(() => undefined);
      })
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, [setMe, refreshSeasonYears]);

  if (loading) return <div className="login-wrap"><p className="subtle">Loading…</p></div>;

  // Forced must-reset gate: an account flagged must_reset can ONLY reach the
  // change-password screen until it sets a new password (mirrors the server guard).
  if (me?.mustReset) {
    return (
      <Routes>
        <Route path="*" element={<ChangePasswordScreen />} />
      </Routes>
    );
  }

  const guard = (el: React.ReactNode) => (me ? <Shell>{el}</Shell> : <Navigate to="/login" replace />);

  return (
    <Routes>
      <Route path="/login" element={me ? <Navigate to="/" replace /> : <LoginScreen />} />
      <Route path="/change-password" element={me ? <ChangePasswordScreen /> : <Navigate to="/login" replace />} />
      <Route path="/" element={guard(<DashboardScreen />)} />
      <Route path="/districts" element={guard(<DistrictBrowserScreen />)} />
      <Route path="/districts/:code" element={guard(<DistrictDetailScreen />)} />
      <Route path="/hunt-areas" element={guard(<HuntAreasScreen />)} />
      <Route path="/portions" element={guard(<PortionsScreen />)} />
      <Route path="/restricted-areas" element={guard(<RestrictedAreasScreen />)} />
      <Route path="/content" element={guard(<ContentScreen />)} />
      <Route path="/fees" element={guard(<FeesScreen />)} />
      <Route path="/important-dates" element={guard(<ImportantDatesScreen />)} />
      <Route path="/contacts" element={guard(<ContactsScreen />)} />
      <Route path="/assets" element={guard(<AssetsScreen />)} />
      <Route path="/print" element={guard(<PrintScreen />)} />
      <Route path="/live" element={guard(<LiveSnapshotScreen />)} />
      <Route path="/corrections" element={guard(<CorrectionsScreen />)} />
      <Route path="/review" element={guard(<ReviewScreen />)} />
      <Route path="/help/guide" element={guard(<UserGuideScreen />)} />
      <Route path="/help/overview" element={guard(<HowItFitsScreen />)} />
      <Route path="/help/glossary" element={guard(<GlossaryScreen />)} />
      <Route path="/audit" element={guard(<AuditLogScreen />)} />
      <Route path="/users" element={guard(<UsersScreen />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
