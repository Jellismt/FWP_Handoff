/**
 * @file errors.ts
 * @module engage-mt/utils
 * @description Typed error classes for Engage MT. Service-layer code wraps raw failures
 *              in these classes so components can match on instanceof and pick UX state.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-04
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export class EngageMtError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NetworkError extends EngageMtError {}
export class AuthError extends EngageMtError {}
export class RateLimitError extends EngageMtError {
  constructor(
    message: string,
    public retryAfterSeconds?: number,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}
export class DataError extends EngageMtError {}
export class NotFoundError extends EngageMtError {}

/** Type-narrow helper for catch blocks. */
export const isEngageMtError = (err: unknown): err is EngageMtError => err instanceof EngageMtError;
