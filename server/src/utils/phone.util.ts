import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { env } from "../config/env";

/**
 * Parses and normalizes to E.164. Local numbers use `PHONE_DEFAULT_REGION` (default IN).
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const defaultCountry = env.phoneDefaultRegion as CountryCode;
  const parsed = parsePhoneNumberFromString(
    trimmed,
    trimmed.startsWith("+") ? undefined : defaultCountry,
  );
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}
