/**
 * @file auditLogRoutes.ts
 * @module engage-mt/server/routes
 * @description Staff audit-log reads. `GET /audit-log` filters by table, user,
 *              and time window and pages by keyset on `audit_id` (newest first;
 *              `meta.nextCursor` carries the next `before`). `GET /audit-log.csv`
 *              streams the same filtered rows as a spreadsheet download for
 *              approvers and admins, capped at EXPORT_MAX_ROWS. Rows are written
 *              by the database triggers (migration 0007), never by route code.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { auditLogExportSchema, auditLogQuerySchema, fail, ok, type AuditLogQuery } from "@engage-mt/regs-shared";
import { query } from "../db/pool.js";
import { requireAuth, requireNotMustReset, requireRole } from "../auth/rbac.js";
import { toCsv } from "../services/csv.js";

export const EXPORT_MAX_ROWS = 10_000;
const COLUMNS = [
  "audit_id",
  "changed_at",
  "changed_by",
  "table_name",
  "row_pk",
  "action_code",
  "publication_id",
  "old_row_json",
  "new_row_json",
] as const;
const SELECT = `SELECT audit_id, table_name, row_pk, action_code, changed_by,
       to_char(changed_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS changed_at,
       publication_id, old_row_json, new_row_json
  FROM regs.audit_log`;

/** Build the WHERE clause + positional params for a filter set. */
export function buildAuditWhere(q: Partial<AuditLogQuery>): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };
  if (q.table) add("table_name = ?", q.table);
  if (q.user) add("lower(changed_by) = lower(?)", q.user);
  if (q.from) add("changed_at >= ?", q.from);
  if (q.to) add("changed_at < ?", q.to);
  if (q.before) add("audit_id < ?", q.before);
  return { where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export async function auditLogRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireNotMustReset);

  app.get("/audit-log", async (request, reply) => {
    const parsed = auditLogQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: parsed.error.issues[0]?.message ?? "invalid query" }]));
    }
    const { where, params } = buildAuditWhere(parsed.data);
    params.push(parsed.data.limit);
    const res = await query<{ audit_id: string }>(
      `${SELECT} ${where} ORDER BY audit_id DESC LIMIT $${params.length}`,
      params,
    );
    const last = res.rows.at(-1);
    return reply.send(
      ok(res.rows, {
        generatedAt: new Date().toISOString(),
        nextCursor: res.rows.length === parsed.data.limit && last ? String(last.audit_id) : null,
      }),
    );
  });

  app.get("/audit-log.csv", { preHandler: [requireRole("approver")] }, async (request, reply) => {
    const parsed = auditLogExportSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: parsed.error.issues[0]?.message ?? "invalid query" }]));
    }
    const { where, params } = buildAuditWhere(parsed.data);
    params.push(EXPORT_MAX_ROWS);
    const res = await query<Record<string, unknown>>(
      `${SELECT} ${where} ORDER BY audit_id DESC LIMIT $${params.length}`,
      params,
    );
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="audit-log-${stamp}.csv"`)
      .header("Cache-Control", "no-store")
      .send(toCsv(res.rows, COLUMNS));
  });
}
