/**
 * @file helpers.ts
 * @module engage-mt/server/test
 * @description Integration-test helpers: build the Fastify app once, and log in as any
 *              fixture role returning the cookie header for subsequent requests.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

export type Role = "viewer" | "editor" | "approver" | "admin";

const EMAILS: Record<Role, string> = {
  viewer: "viewer@fwp.mt.gov",
  editor: "editor@fwp.mt.gov",
  approver: "approver@fwp.mt.gov",
  admin: "admin@fwp.mt.gov",
};
const PW: Record<Role, string> = {
  viewer: "test-password-123456",
  editor: "test-password-123456",
  approver: "test-password-123456",
  admin: "admin-password-123456",
};

export async function makeApp(): Promise<FastifyInstance> {
  return buildApp();
}

/** Log in and return { [cookieName]: value } for injection. */
export async function loginAs(app: FastifyInstance, role: Role): Promise<Record<string, string>> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/staff/auth/login",
    payload: { email: EMAILS[role], password: PW[role] },
  });
  return Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));
}

export async function loginRaw(app: FastifyInstance, email: string, password: string) {
  return app.inject({ method: "POST", url: "/api/v1/staff/auth/login", payload: { email, password } });
}
