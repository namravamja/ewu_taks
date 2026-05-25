import { Injectable } from '@nestjs/common';
import * as geoip from 'geoip-lite';

import type { GeoLocationResult } from './interfaces/geolocation-result.interface';

@Injectable()
export class GeoLocationService {
  /** Look up geolocation data for an IP address. Returns `null` if unavailable. */
  lookup(ip: string): GeoLocationResult | null {
    const result = geoip.lookup(ip);
    if (!result) {
      return null;
    }

    return {
      country: result.country || undefined,
      region: result.region || undefined,
      city: result.city || undefined,
      timezone: result.timezone || undefined,
    };
  }
}
