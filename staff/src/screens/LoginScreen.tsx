/**
 * @file LoginScreen.tsx
 * @module engage-mt/staff
 * @description Email/password sign-in. On success, stores the identity and routes home.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-05
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api.js";
import { useApp } from "../store.js";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setMe = useApp((s) => s.setMe);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rows = await api.login(email, password);
      setMe(rows[0] ?? null);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? "That email and password didn't match. Check them and try again." : "Sign-in failed — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h2>FWP Regs Manager</h2>
        <p className="subtle">Author and publish Montana's hunting regulations. Accounts are issued by an FWP admin.</p>
        <div style={{ marginTop: 12 }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%" }} />
        </div>
        {error && <p className="error-text" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
