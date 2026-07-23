/** Portal display timezone — matches service-daemon/Portal and gx-daemon KST timestamps. */
export const PORTAL_TIMEZONE = 'Asia/Seoul';

const HAS_TZ = /[zZ]$|[+-]\d{2}:\d{2}$/;

/** Parse API/datetime strings; naive values without offset are treated as KST. */
export function parsePortalDate(value?: string | null): Date | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  if (HAS_TZ.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(`${normalized}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateTimeFmt: Intl.DateTimeFormatOptions = {
  timeZone: PORTAL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

const dateTimeDetailFmt: Intl.DateTimeFormatOptions = {
  timeZone: PORTAL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

const dateFmt: Intl.DateTimeFormatOptions = {
  timeZone: PORTAL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

/** Order list / table datetime (KST). */
export function formatPortalDateTime(value?: string | null, fallback = '—'): string {
  const d = parsePortalDate(value);
  if (!d) return fallback;
  return d.toLocaleString('ko-KR', dateTimeFmt);
}

/** Order detail timestamps with seconds (KST). */
export function formatPortalDateTimeDetail(value?: string | null, fallback = '—'): string {
  const d = parsePortalDate(value);
  if (!d) return fallback;
  return d.toLocaleString('ko-KR', dateTimeDetailFmt);
}

/** Calendar date only (KST). */
export function formatPortalDate(value?: string | null, fallback = '—'): string {
  const d = parsePortalDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('ko-KR', dateFmt);
}

/** Start of calendar day in KST for date-range filters. */
export function portalDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}

/** End of calendar day in KST for date-range filters. */
export function portalDayEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+09:00`);
}

/** Today as YYYY-MM-DD in KST (forms, defaults). */
export function portalTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PORTAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Current time label in KST. */
export function formatPortalTimeNow(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: PORTAL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}
