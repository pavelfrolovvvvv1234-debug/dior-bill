/** Standard dedicated server regions — USA, Germany, Turkey */
export const DEDICATED_COUNTRY_CODES = ["US", "DE", "TR"] as const;

export const DEDICATED_LOCATION_DEFS = [
  { code: "us-nyc", name: "USA", country: "US", city: "New York" },
  { code: "de-fra", name: "Germany", country: "DE", city: "Frankfurt" },
  { code: "tr-ist", name: "Turkey", country: "TR", city: "Istanbul" },
] as const;
