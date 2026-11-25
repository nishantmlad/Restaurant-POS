export interface TimezoneOption {
  value: string;
  label: string;
  offset?: string;
}

// Formats a timezone with its current GMT offset, e.g. "Asia/Kolkata (GMT+05:30)"
export function formatTimezoneLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "";
    return `${tz} (${tzPart || "GMT"})`;
  } catch {
    return tz;
  }
}

// Well-known and popular global timezones
export const POPULAR_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Kuala_Lumpur",
  "Asia/Jakarta",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Colombo",
  "Asia/Karachi",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Dublin",
  "Europe/Athens",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Africa/Lagos",
  "UTC",
];

export function getAllTimezones(): TimezoneOption[] {
  let allTzs: string[] = POPULAR_TIMEZONES;
  if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
    try {
      const supported = (Intl as any).supportedValuesOf("timeZone") as string[];
      // Keep popular ones on top, then alphabetical order for the rest
      const popularSet = new Set(POPULAR_TIMEZONES);
      const rest = supported.filter((tz) => !popularSet.has(tz)).sort();
      allTzs = [...POPULAR_TIMEZONES, ...rest];
    } catch {
      allTzs = POPULAR_TIMEZONES;
    }
  }

  return allTzs.map((tz) => ({
    value: tz,
    label: formatTimezoneLabel(tz),
  }));
}

