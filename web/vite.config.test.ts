/**
 * @file vite.config.test.ts
 * @module engage-mt/web
 * @description Coverage for the build-time helpers in vite.config.ts: the
 *              ArcGIS theme version stamp and the vendor chunking rule.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { arcgisMajorMinor, arcgisThemeHtml, staticReach, vendorChunk } from "./vite.config";

describe("arcgisThemeHtml", () => {
  it("reduces the SDK version to the CDN's major.minor path segment", () => {
    expect(arcgisMajorMinor("5.0.19")).toBe("5.0");
    expect(arcgisMajorMinor("5.1.0")).toBe("5.1");
  });

  it("stamps the token in index.html and leaves the rest untouched", () => {
    const plugin = arcgisThemeHtml("5.0.19");
    const transform = plugin.transformIndexHtml as (html: string) => string;
    expect(
      transform('<link href="https://js.arcgis.com/%ARCGIS_MAJOR_MINOR%/x.css" /><p>hi</p>'),
    ).toBe('<link href="https://js.arcgis.com/5.0/x.css" /><p>hi</p>');
  });

  it("index.html carries the token and a preconnect to the ArcGIS CDN", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toContain("%ARCGIS_MAJOR_MINOR%");
    expect(html).toContain('<link rel="preconnect" href="https://js.arcgis.com" crossorigin />');
    expect(html).not.toMatch(/js\.arcgis\.com\/\d/);
  });
});

describe("vendorChunk", () => {
  const never = () => false;
  const always = () => true;
  it("groups the framework, and Calcite with the statically reachable ArcGIS modules", () => {
    expect(vendorChunk("/repo/node_modules/react-dom/index.js", never)).toBe("vendor-react");
    expect(vendorChunk("/repo/node_modules/zustand/index.js", never)).toBe("vendor-react");
    expect(vendorChunk("/repo/node_modules/@esri/calcite-components/dist/x.js", never)).toBe(
      "vendor-esri",
    );
    expect(vendorChunk("/repo/node_modules/@arcgis/core/views/MapView.js", always)).toBe(
      "vendor-esri",
    );
  });

  it("leaves lazily reached ArcGIS modules and app code in their own chunks", () => {
    expect(
      vendorChunk("/repo/node_modules/@arcgis/core/views/2d/layers/x.js", never),
    ).toBeUndefined();
    expect(vendorChunk("/repo/web/src/App.tsx", always)).toBeUndefined();
    expect(vendorChunk("/repo/node_modules/lucide-react/index.js", always)).toBeUndefined();
  });

  it("staticReach follows static imports from the entry and ignores dynamic edges", () => {
    const graph = {
      entry: { isEntry: true, importedIds: ["a", "b"] },
      a: { isEntry: false, importedIds: ["c"] },
      b: { isEntry: false, importedIds: [] },
      c: { isEntry: false, importedIds: [] },
      lazy: { isEntry: false, importedIds: ["d"] },
      d: { isEntry: false, importedIds: [] },
    } as Record<string, { isEntry: boolean; importedIds: string[] }>;
    const reach = staticReach({
      getModuleIds: () => Object.keys(graph)[Symbol.iterator](),
      getModuleInfo: (id) => graph[id] ?? null,
    });
    expect([...reach].sort()).toEqual(["a", "b", "c", "entry"]);
  });
});
