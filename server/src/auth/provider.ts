/**
 * @file provider.ts
 * @module engage-mt/server/auth
 * @description The AuthProvider seam. PasswordAuthProvider is impl #1 (email/password
 *              today); the Oracle-era XmtOAuthProvider slots in behind this same
 *              interface with sessions unchanged. Routes depend ONLY on this interface.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { StaffRole } from "@engage-mt/regs-shared";

/** The authenticated principal — what routes see after auth resolves. */
export interface StaffIdentity {
  userId: string;
  email: string;
  displayName: string;
  role: StaffRole;
  mustReset: boolean;
}

export interface Credentials {
  email: string;
  password: string;
}

/** Pluggable authentication backend. */
export interface AuthProvider {
  /** Verify credentials. Returns the identity, or null on any failure. */
  authenticate(creds: Credentials): Promise<StaffIdentity | null>;
}
