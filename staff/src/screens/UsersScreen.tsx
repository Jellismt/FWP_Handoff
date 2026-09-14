/**
 * @file UsersScreen.tsx
 * @module engage-mt/staff
 * @description Admin user management: list, create (reveals a one-time temp password),
 *              change role, deactivate, reset password. Admin-only (server-enforced).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-05
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type UserRow } from "../api.js";

const ROLES = ["viewer", "editor", "approver", "admin"];
/** One-line role descriptions (ordered ladder — each includes the ones below it). */
const ROLE_DESC: Record<string, string> = {
  viewer: "Read everything, including the audit log.",
  editor: "Viewer + create/edit/soft-delete draft regulations.",
  approver: "Editor + publish a season year and approve corrections.",
  admin: "Approver + manage staff accounts.",
};

export function UsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("editor");
  const [reveal, setReveal] = useState<{ email: string; temp: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () => api.users().then(setUsers).catch((e) => setMsg(String(e)));
  useEffect(() => { void reload(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api.createUser(email, name, role);
      setReveal({ email, temp: r[0]!.temp_password });
      setEmail(""); setName("");
      await reload();
    } catch (err) { setMsg(err instanceof ApiError ? err.message : String(err)); }
  };

  const resetPw = async (u: UserRow) => {
    const r = await api.resetUserPassword(u.user_id);
    setReveal({ email: u.email, temp: r[0]!.temp_password });
    await reload();
  };

  return (
    <section>
      <h2>Staff users</h2>
      <p className="subtle">
        Create accounts and manage <Link className="district-link" to="/help/glossary#roles">roles</Link>. New accounts get a one-time temporary password (shown once) and must reset it on first sign-in.
      </p>

      {reveal && (
        <div className="card" style={{ borderColor: "var(--fwp-green)" }}>
          <strong>Temporary password for {reveal.email}</strong>
          <p style={{ fontFamily: "monospace", fontSize: "1.1rem", margin: "8px 0" }}>{reveal.temp}</p>
          <p className="subtle">Copy this now — it won't be shown again. Hand it to the user out-of-band.</p>
          <button className="secondary" onClick={() => setReveal(null)}>Done</button>
        </div>
      )}

      <form className="card" onSubmit={create}>
        <h3 style={{ marginTop: 0 }}>Add user</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r} title={ROLE_DESC[r]}>{r}</option>)}</select>
            <div className="subtle" style={{ fontSize: "0.72rem", marginTop: 2, maxWidth: 220 }}>{ROLE_DESC[role]}</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}><button type="submit">Create</button></div>
        </div>
        {msg && <p className="error-text" style={{ marginTop: 8 }}>{msg}</p>}
      </form>

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.email}</td>
                  <td>{u.display_name}</td>
                  <td>
                    <select value={u.role} title={ROLE_DESC[u.role]} onChange={async (e) => { await api.patchUser(u.user_id, { role: e.target.value }); await reload(); }}>
                      {ROLES.map((r) => <option key={r} value={r} title={ROLE_DESC[r]}>{r}</option>)}
                    </select>
                  </td>
                  <td>{u.is_active_flag === 1 ? "active" : "inactive"}{u.must_reset === 1 ? " · must reset" : ""}</td>
                  <td>
                    <button className="secondary" onClick={() => resetPw(u)}>Reset password</button>
                    {u.is_active_flag === 1 && <button className="danger" style={{ marginLeft: 6 }} onClick={async () => { await api.patchUser(u.user_id, { is_active: false }); await reload(); }}>Deactivate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
