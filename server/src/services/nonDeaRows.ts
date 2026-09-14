/**
 * @file nonDeaRows.ts
 * @module engage-mt/server/services
 * @description Transition helper for the cutover-compat endpoint. The unified slug
 *              `hunting-regulations-unified` covers every species; this DB owns only
 *              DEA. To keep the slug complete during transition, the compat endpoint
 *              merges DEA snapshot rows with the remaining species read from a bundled
 *              JSON (`hunting-regs-nondea.json`) that the build pipeline emits from the
 *              existing per-species artifacts. Absent file → [] (DEA-only) + a warning,
 *              never fabricated rows.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizedRegulationSchema, type NormalizedRegulation } from "@engage-mt/regs-shared";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Candidate locations, first hit wins. Env override → repo default. */
function candidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.REGS_NONDEA_JSON) paths.push(process.env.REGS_NONDEA_JSON);
  // repo-relative default: server/src/services → repo root → web/public/data
  paths.push(join(HERE, "../../../web/public/data/hunting-regs-nondea.json"));
  return paths;
}

let cache: { rows: NormalizedRegulation[]; warning: string | null } | null = null;

/** Load the non-DEA rows once. Returns [] + a warning string when unavailable. */
export async function loadNonDeaRows(): Promise<{ rows: NormalizedRegulation[]; warning: string | null }> {
  if (cache) return cache;
  for (const p of candidatePaths()) {
    try {
      const text = await readFile(p, "utf8");
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
      const rows: NormalizedRegulation[] = [];
      for (const raw of arr) {
        const r = normalizedRegulationSchema.safeParse(raw);
        if (r.success && r.data.species_group !== "dea") rows.push(r.data);
      }
      cache = { rows, warning: null };
      return cache;
    } catch {
      // try next candidate
    }
  }
  cache = {
    rows: [],
    warning:
      "Non-DEA species rows unavailable — serving DEA-only. Emit web/public/data/hunting-regs-nondea.json to complete the unified slug.",
  };
  return cache;
}

/** Test/refresh hook. */
export function resetNonDeaCache(): void {
  cache = null;
}
