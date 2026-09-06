/**
 * @file provider.ts
 * @module engage-mt/server/services/cms
 * @description The CMS seam. Regulation maps (region plates, CWD/zone/bear figures,
 *              per-area maps) come from FWP's Bloomreach CMS. `CmsProvider` is the
 *              interface; `BloomreachStubProvider` serves deterministic placeholder SVGs
 *              today (STUB-035), `BloomreachProvider` is the real Delivery-API client
 *              (unreachable until BLOOMREACH_BASE_URL/CHANNEL are set). pickCmsProvider()
 *              chooses based on env — one swap when FWP grants access.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export interface CmsAssetMeta {
  url: string;
  title: string;
  altText: string;
  width?: number;
  height?: number;
  mimeType?: string;
  lastModified?: string;
}

export interface CmsProvider {
  /** Resolve a Bloomreach document id to a public asset URL + metadata. */
  getAsset(docId: string): Promise<CmsAssetMeta>;
  /** Just the URL (used by the region/area detail endpoints). */
  resolveUrl(docId: string): Promise<string>;
  readonly kind: "stub" | "bloomreach";
}

/**
 * Serves a deterministic placeholder SVG per docId from the server's own
 * /api/v1/cms-stub/assets/:docId route. Lets staff attach + preview maps before FWP
 * Bloomreach access exists.
 */
export class BloomreachStubProvider implements CmsProvider {
  readonly kind = "stub" as const;
  constructor(private readonly selfBase: string) {}
  async getAsset(docId: string): Promise<CmsAssetMeta> {
    return {
      url: `${this.selfBase}/api/v1/cms-stub/assets/${encodeURIComponent(docId)}`,
      title: `Placeholder: ${docId}`,
      altText: `Placeholder map for ${docId}`,
      mimeType: "image/svg+xml",
    };
  }
  async resolveUrl(docId: string): Promise<string> {
    return `${this.selfBase}/api/v1/cms-stub/assets/${encodeURIComponent(docId)}`;
  }
}

/**
 * Real Bloomreach Delivery API client (STUB-035). Written but inert until env is set;
 * the shape follows the Delivery API document endpoint.
 */
export class BloomreachProvider implements CmsProvider {
  readonly kind = "bloomreach" as const;
  constructor(private readonly baseUrl: string, private readonly channel: string) {}
  async getAsset(docId: string): Promise<CmsAssetMeta> {
    const url = `${this.baseUrl}/delivery/site/v1/channels/${this.channel}/documents/${encodeURIComponent(docId)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Bloomreach ${res.status} for ${docId}`);
    const doc = (await res.json()) as Record<string, unknown>;
    const data = (doc.data ?? doc) as Record<string, unknown>;
    return {
      url: String(data.url ?? data.contentUrl ?? ""),
      title: String(data.title ?? docId),
      altText: String(data.altText ?? data.description ?? docId),
      width: typeof data.width === "number" ? data.width : undefined,
      height: typeof data.height === "number" ? data.height : undefined,
      mimeType: typeof data.mimeType === "string" ? data.mimeType : undefined,
      lastModified: typeof data.lastModified === "string" ? data.lastModified : undefined,
    };
  }
  async resolveUrl(docId: string): Promise<string> {
    return (await this.getAsset(docId)).url;
  }
}

let cached: CmsProvider | null = null;

/** Choose the CMS provider from env. Real client only when both vars are set. */
export function pickCmsProvider(selfBase: string): CmsProvider {
  if (cached) return cached;
  const base = process.env.BLOOMREACH_BASE_URL;
  const channel = process.env.BLOOMREACH_CHANNEL;
  cached = base && channel ? new BloomreachProvider(base, channel) : new BloomreachStubProvider(selfBase);
  return cached;
}

/**
 * XML-escape untrusted text before interpolating it into SVG/XML markup.
 * `&` MUST be escaped first so we don't double-escape the entities we introduce.
 * Prevents reflected XSS when a client-controlled value lands inside an
 * `image/svg+xml` document (a browser renders SVG as an active document).
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Deterministic placeholder SVG map plate for a docId (served by the stub route). */
export function placeholderMapSvg(docId: string): string {
  // Rough Montana silhouette + the doc id label — enough for staff to preview placement.
  // docId is client-controlled (route param), so escape it before it enters the SVG.
  const label = escapeXml(docId.replace(/^stub:/, "").replace(/[-_]/g, " "));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" role="img" aria-label="${label}">
  <rect width="400" height="260" fill="#eef1f4"/>
  <path d="M30 70 L110 60 L120 40 L180 44 L185 60 L370 66 L366 210 L200 214 L120 210 L30 200 Z"
        fill="#d9dee6" stroke="#9aa6b6" stroke-width="2"/>
  <text x="200" y="130" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700" fill="#334">${label}</text>
  <text x="200" y="152" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#667">FWP CMS placeholder · Bloomreach pending</text>
</svg>`;
}
