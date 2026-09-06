/**
 * @file ChangePasswordScreen.tsx
 * @module engage-mt/staff
 * @description Change-password screen — also the forced must-reset gate (a first-login
 *              admin lands here and can't proceed until they set a new password).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api.js";
import { useApp } from "../store.js";

export function ChangePasswordScreen() {
  const { me, setMe } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const forced = me?.mustReset ?? false;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError("New passwords don't match."); return; }
    if (next.length < 12) { setError("New password must be at least 12 characters."); return; }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      if (me) setMe({ ...me, mustReset: false });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h2>{forced ? "Set your password" : "Change password"}</h2>
        <p className="subtle">
          {forced
            ? "This is a first-time or reset account. Choose a new password to continue."
            : "Update your Regs Manager password."}
        </p>
        <div style={{ marginTop: 12 }}>
          <label htmlFor="cur">Current password</label>
          <input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label htmlFor="new">New password (12+ characters)</label>
          <input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label htmlFor="conf">Confirm new password</label>
          <input id="conf" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={{ width: "100%" }} />
        </div>
        {error && <p className="error-text" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
