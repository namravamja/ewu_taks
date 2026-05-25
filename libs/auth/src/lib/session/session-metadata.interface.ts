import type { GeoLocationResult } from '@mediastar/core';

/** Client metadata captured at login and token refresh. */
export interface ISessionMetadata {
  ipAddress: string | undefined;
  userAgent: string | undefined;
  metadata?: GeoLocationResult | null;
}
