/** Dedicated server regions — Netherlands, USA, Turkey, Germany */
export const DEDICATED_COUNTRY_CODES = ["NL", "US", "TR", "DE"] as const;

export const DEDICATED_LOCATION_DEFS = [
  { code: "nl-ams", name: "Netherlands", country: "NL", city: "Amsterdam" },
  { code: "us-nyc", name: "USA", country: "US", city: "New York" },
  { code: "tr-ist", name: "Turkey", country: "TR", city: "Istanbul" },
  { code: "de-fra", name: "Germany", country: "DE", city: "Frankfurt" },
] as const;
