/**
 * @file lockHelpers.ts
 * @module engage-mt/server/routes
 * @description Shared optimistic-lock helpers for the staff CRUD routes. Every mutation
 *              of a lock-bearing row carries `expected_updated_at`; a mismatch means
 *              someone else changed it → 409 CONFLICT (with the current updated_by/at so
 *              the SPA can render the conflict banner without a refetch). Child-collection
 *              PUTs lock/bump the PARENT (which also fires the parent's audit trigger).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { PoolClient } from "pg";
import type { FastifyReply } from "fastify";
import { fail } from "@engage-mt/regs-shared";

export class ConflictError extends Error {
  constructor(
    public current?: { updated_by?: string; updated_at?: string },
  ) {
    super("Row changed since you loaded it.");
  }
}

/**
 * UPDATE a lock-bearing row: applies `sets`, bumps revision/updated_by/updated_at,
 * guarded by `updated_at = expected`. Throws ConflictError on 0 rows (fetches the
 * current lock values for the message). `table` and `pkCol` are trusted internal
 * literals; all values are parameterized.
 */
export async function lockedUpdate(
  client: PoolClient,
  table: string,
  pkCol: string,
  id: string,
  actor: string,
  expectedUpdatedAt: string,
  sets: Record<string, unknown>,
): Promise<void> {
  const cols = Object.keys(sets);
  const params: unknown[] = Object.values(sets);
  const assigns = cols.map((c, i) => `${c} = $${i + 1}`);
  params.push(actor); // updated_by
  assigns.push(`updated_by = $${params.length}`);
  assigns.push(`revision = revision + 1`);
  assigns.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);
  const idIdx = params.length;
  params.push(expectedUpdatedAt);
  const lockIdx = params.length;
  // Compare at second granularity: GETs serialize updated_at to whole-second ISO
  // (…SS"Z"), so an exact match against the microsecond-precision stored value would
  // always miss. Second granularity is ample for optimistic locking.
  const res = await client.query(
    `UPDATE ${table} SET ${assigns.join(", ")}
     WHERE ${pkCol} = $${idIdx}
       AND date_trunc('second', updated_at) = date_trunc('second', $${lockIdx}::timestamptz)
     RETURNING ${pkCol}`,
    params,
  );
  if (res.rowCount === 0) {
    const cur = await client.query<{ updated_by: string; updated_at: string }>(
      `SELECT updated_by, to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM ${table} WHERE ${pkCol} = $1`,
      [id],
    );
    throw new ConflictError(cur.rows[0]);
  }
}

/** Bump a parent row's lock (revision/updated_at) under an expected-lock guard. */
export async function bumpParent(
  client: PoolClient,
  table: string,
  pkCol: string,
  id: string,
  actor: string,
  expectedUpdatedAt: string,
): Promise<void> {
  await lockedUpdate(client, table, pkCol, id, actor, expectedUpdatedAt, {});
}

/** Translate a ConflictError into the 409 envelope; rethrow anything else. */
export async function send409IfConflict(reply: FastifyReply, err: unknown): Promise<boolean> {
  if (err instanceof ConflictError) {
    await reply.code(409).send({
      data: null,
      meta: err.current ? { conflict: err.current } : null,
      errors: [{ code: "CONFLICT", message: `Changed by ${err.current?.updated_by ?? "someone"} at ${err.current?.updated_at ?? "?"} — reload.` }],
    });
    return true;
  }
  return false;
}

/**
 * Standard 500 fallthrough for unexpected route errors. Logs the full error
 * server-side (pino) but returns a GENERIC message — never `String(err)`, which
 * would leak Postgres constraint/column names + SQL fragments to the client.
 */
export async function send500(reply: FastifyReply, err: unknown): Promise<FastifyReply> {
  reply.log.error({ err }, "route 500");
  return reply.code(500).send(fail([{ code: "INTERNAL", message: "An unexpected error occurred." }]));
}

/**
 * Safe catch-all for write (create/update/delete) route handlers. Replaces the
 * old `String(err)` interpolation that leaked raw DB error text:
 *  - optimistic-lock ConflictError → 409 with the current lock values;
 *  - known Postgres constraint violations → 409 with a generic, safe message;
 *  - anything else → 500 (full detail logged server-side only).
 */
export async function sendWriteError(reply: FastifyReply, err: unknown): Promise<FastifyReply> {
  if (await send409IfConflict(reply, err)) return reply;
  reply.log.error({ err }, "write route error");
  const code = (err as { code?: unknown }).code;
  if (code === "23505") {
    // unique_violation
    return reply.code(409).send(fail([{ code: "CONFLICT", message: "That record conflicts with an existing one." }]));
  }
  if (code === "23503" || code === "23502" || code === "23514") {
    // foreign_key / not_null / check violation
    return reply.code(409).send(fail([{ code: "CONFLICT", message: "The request references missing or invalid related data." }]));
  }
  return reply.code(500).send(fail([{ code: "INTERNAL", message: "An unexpected error occurred." }]));
}
