/**
 * @file passwordProvider.ts
 * @module engage-mt/server/auth
 * @description Email/password AuthProvider using argon2id. Verifies the hash even for
 *              unknown emails (constant-ish time → no user enumeration). No STUB-OAUTH
 * Tokens anywhere — this is real auth (governs the public app's
 *              mocks, not this internal tool).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { verify, hash } from "@node-rs/argon2";
import type { StaffRole } from "@engage-mt/regs-shared";
import { query } from "../db/pool.js";
import type { AuthProvider, Credentials, StaffIdentity } from "./provider.js";

interface StaffUserRow {
  user_id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: StaffRole;
  must_reset: number;
  is_active_flag: number;
}

// A dummy hash to verify against when the email is unknown, so timing doesn't leak
// account existence. Generated once at module load (cheap).
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hash("engage-mt-nonexistent-account");
  return dummyHashPromise;
}

export class PasswordAuthProvider implements AuthProvider {
  async authenticate(creds: Credentials): Promise<StaffIdentity | null> {
    const res = await query<StaffUserRow>(
      `SELECT user_id, email, password_hash, display_name, role, must_reset, is_active_flag
       FROM regs.staff_user WHERE email = $1`,
      [creds.email.toLowerCase().trim()],
    );
    const row = res.rows[0];
    if (!row || row.is_active_flag !== 1) {
      // Still do a verify to equalize timing, then fail.
      await verify(await getDummyHash(), creds.password).catch(() => false);
      return null;
    }
    const okPassword = await verify(row.password_hash, creds.password).catch(() => false);
    if (!okPassword) return null;
    return {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      mustReset: row.must_reset === 1,
    };
  }
}
