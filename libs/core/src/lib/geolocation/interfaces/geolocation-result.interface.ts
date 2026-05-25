/** Result of a GeoIP lookup. All fields are optional — a partial result is valid. */
export type GeoLocationResult = {
  /** ISO 3166-1 alpha-2 country code (e.g. "US"). */
  country?: string;
  /** ISO 3166-2 subdivision code (e.g. "WA"). */
  region?: string;
  /** City name (e.g. "Cheney"). */
  city?: string;
  /** IANA timezone identifier (e.g. "America/Los_Angeles"). */
  timezone?: string;
};
