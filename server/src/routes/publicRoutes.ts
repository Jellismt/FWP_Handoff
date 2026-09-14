/**
 * @file publicRoutes.ts
 * @module engage-mt/server/routes
 * @description Public read API (anonymous, CORS-allowed, reads snapshots ONLY).
 *              - GET /datasets/hunting-regulations-unified  ← the cutover-compat flip target
 *              - GET /hunting/regulations                    ← canonical filtered
 *              - GET /hunting/seasons                        ← published years
 *              ETag + If-None-Match → 304. See docs/regs-manager/api.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, fail, type NormalizedRegulation } from "@engage-mt/regs-shared";
import {
  latestPublishedYear,
  latestVersionFor,
  queryPublishedRegs,
} from "../db/publishedRepo.js";
import { loadNonDeaRows } from "../services/nonDeaRows.js";
import { query } from "../db/pool.js";

const CACHE_CONTROL = "max-age=3600, must-revalidate";

function weakEtag(seasonYear: number, version: number, extra: string): string {
  const h = createHash("sha1").update(`${seasonYear}:${version}:${extra}`).digest("hex").slice(0, 16);
  return `W/"${seasonYear}-v${version}-${h}"`;
}

const regQuerySchema = z.object({
  species: z.enum(["deer", "elk", "antelope"]).optional(),
  district: z.string().max(10).optional(),
  region: z.coerce.number().int().gte(1).lte(7).optional(),
  portion: z.string().max(40).optional(),
  season_year: z.coerce.number().int().optional(),
});

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // ── Cutover-compat: the exact URL a REST-enabled client would request ────
  app.get("/datasets/hunting-regulations-unified", async (request, reply) => {
    const current = await latestPublishedYear();
    if (!current) {
      return reply.code(200).send(ok<NormalizedRegulation>([], { generatedAt: new Date().toISOString() }));
    }
    const dea = await queryPublishedRegs({ seasonYear: current.season_year, version: current.version });
    const nonDea = await loadNonDeaRows();
    const data = [...dea, ...nonDea.rows];
    const etag = weakEtag(current.season_year, current.version, `all:${data.length}`);
    if (request.headers["if-none-match"] === etag) {
      return reply.code(304).header("ETag", etag).header("Cache-Control", CACHE_CONTROL).send();
    }
    reply.header("ETag", etag).header("Cache-Control", CACHE_CONTROL);
    return reply.send(
      ok<NormalizedRegulation>(data, {
        generatedAt: current.published_at,
        effectiveFrom: current.effective_from ?? undefined,
        validUntil: current.valid_until ?? undefined,
        etag,
        sourceLabel: `FWP — ${current.season_year} DEA hunting regulations (published v${current.version})`,
        version: current.version,
      }),
    );
  });

  // ── Canonical filtered ───────────────────────────────────────────────────
  app.get("/hunting/regulations", async (request, reply) => {
    const parsed = regQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: parsed.error.message }]));
    }
    const f = parsed.data;
    const seasonYear = f.season_year ?? (await latestPublishedYear())?.season_year;
    if (seasonYear == null) {
      return reply.send(ok<NormalizedRegulation>([], { generatedAt: new Date().toISOString() }));
    }
    const version = await latestVersionFor(seasonYear);
    if (version == null) {
      return reply.code(404).send(fail([{ code: "NOT_FOUND", message: `No published regs for ${seasonYear}.` }]));
    }
    const data = await queryPublishedRegs({
      seasonYear,
      version,
      species: f.species,
      district: f.district,
      region: f.region,
      portion: f.portion,
    });
    const etag = weakEtag(seasonYear, version, `${f.species ?? ""}:${f.district ?? ""}:${f.region ?? ""}:${f.portion ?? ""}:${data.length}`);
    if (request.headers["if-none-match"] === etag) {
      return reply.code(304).header("ETag", etag).header("Cache-Control", CACHE_CONTROL).send();
    }
    reply.header("ETag", etag).header("Cache-Control", CACHE_CONTROL);
    return reply.send(
      ok<NormalizedRegulation>(data, {
        generatedAt: new Date().toISOString(),
        etag,
        filters: { ...f, season_year: seasonYear },
      }),
    );
  });

  // ── Published seasons list ───────────────────────────────────────────────
  app.get("/hunting/seasons", async (_request, reply) => {
    const res = await query<{ season_year: number; status_code: string; latest_version: number | null }>(
      `SELECT sy.season_year, sy.status_code,
              (SELECT max(version) FROM regs.publication p WHERE p.season_year = sy.season_year) AS latest_version
       FROM regs.season_year sy
       ORDER BY sy.season_year DESC`,
    );
    return reply.send(
      ok(
        res.rows.map((r) => ({
          season_year: Number(r.season_year),
          status_code: r.status_code,
          latest_version: r.latest_version == null ? null : Number(r.latest_version),
        })),
        { generatedAt: new Date().toISOString() },
      ),
    );
  });
}
