/**
 * @file config.ts
 * @module engage-mt/server
 * @description Typed environment config for the FWP Regs Manager server. All secrets
 * Are env-var-injected — never baked into the image.
 *              Parsed once at boot; a missing required var fails fast with a clear message.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { z } from "zod";
import { parseIpAllowlist } from "./security/ipAllowlist.js";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8080),
  /** Postgres connection string, injected by Railway's Postgres plugin. */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /**
   * Postgres TLS mode (encryption-in-transit; CIS "protect data in transit").
   *   off     — no TLS (local docker-compose, CI, Railway private network).
   *   require — encrypt but don't verify the chain (managed PG w/o a public CA).
   *   verify  — encrypt + verify the server cert (needs a CA the client trusts).
   * Unset → defaults to `require` in production, `off` elsewhere (see pool.ts).
   */
  DATABASE_SSL: z.enum(["off", "require", "verify"]).optional(),
  /** Signs session cookies. Must be a long random string in production. */
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be ≥16 chars"),
  /** Comma-separated allowed origins for the PUBLIC read API (engage-mt-web + localhost). */
  PUBLIC_CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  /** Optional allowlist for staff routes: exact IPs and CIDR ranges (IPv4/IPv6); empty = disabled. */
  STAFF_IP_ALLOWLIST: z
    .string()
    .default("")
    .transform((s, ctx) => {
      try {
        return parseIpAllowlist(s.split(","));
      } catch (err) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: (err as Error).message });
        return z.NEVER;
      }
    }),
  /** First-boot admin seed (removed after first user exists). */
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(14).optional(),
  /** Path to the built staff SPA served via @fastify/static (relative to dist). */
  STAFF_DIST_DIR: z.string().default("../../staff/dist"),
});

export type AppConfig = z.infer<typeof configSchema>;

let cached: AppConfig | null = null;

/** Parse + cache process.env. Throws with a readable error on missing/invalid vars. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: reset the cache so a test can inject a fresh env. */
export function resetConfigCache(): void {
  cached = null;
}
