// How much of the company profile is filled in, as a percentage. Shown on
// the dashboard and the profile page, so the user knows what is missing.
import type { CompanyProfile } from "./api";

export const PROFILE_FIELDS = [
  "business_type",
  "trade_licence_no",
  "tin",
  "vat_reg",
  "annual_turnover",
  "liquid_assets",
  "years_of_experience",
] as const;

export function profileCompleteness(profile: CompanyProfile | null): number {
  if (!profile) return 0;
  const filled = PROFILE_FIELDS.filter((field) => {
    const value = profile[field];
    return value !== null && String(value).trim() !== "";
  }).length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}
