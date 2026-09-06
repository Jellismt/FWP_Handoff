/**
 * @file setup.ts
 * @module engage-mt/staff
 * @description Vitest setup — jest-dom matchers.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-05
 * @updated 2026-09-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
