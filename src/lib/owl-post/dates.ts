// "Today" for Owl Post is the New York calendar day, wherever the server runs.
// Calendar dates are plain YYYY-MM-DD values; day arithmetic happens in UTC so
// daylight-saving changes can never produce a fractional day.

export type IsoDate = string & { readonly __isoDate: unique symbol };

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const newYorkFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});
// Calendar dates are stored as UTC midnight, so they are formatted in UTC.
const datelineFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const monthDayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" });
const shortMonthFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });

export function parseIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== "string") return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return roundTrips ? (value as IsoDate) : null;
}

export function newYorkDate(now: Date): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return newYorkFormatter.format(now) as IsoDate;
}

function toUtcMidnight(date: IsoDate) {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10) as IsoDate;
}

export function dayNumber(date: IsoDate) {
  return Math.round(toUtcMidnight(date) / DAY_MS);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMidnight(date) + days * DAY_MS);
}

/** Monday of the week containing `date`. */
export function weekStart(date: IsoDate): IsoDate {
  const weekday = new Date(toUtcMidnight(date)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

export function formatDateline(date: IsoDate) {
  return datelineFormatter.format(new Date(toUtcMidnight(date)));
}

export function formatMonthDay(date: IsoDate) {
  return monthDayFormatter.format(new Date(toUtcMidnight(date)));
}

export function formatWeekday(date: IsoDate) {
  return weekdayFormatter.format(new Date(toUtcMidnight(date)));
}

/** "Oct 5 – 11", or "Sep 28 – Oct 4" when the week crosses into a new month. */
export function formatWeekRange(monday: IsoDate) {
  const start = new Date(toUtcMidnight(monday));
  const end = new Date(toUtcMidnight(addDays(monday, 6)));
  const startMonth = shortMonthFormatter.format(start);
  const endMonth = shortMonthFormatter.format(end);
  const endLabel = endMonth === startMonth ? `${end.getUTCDate()}` : `${endMonth} ${end.getUTCDate()}`;
  return `${startMonth} ${start.getUTCDate()} – ${endLabel}`;
}

/** The day on an owl's postmark, e.g. "OCT 8". */
export function formatPostmark(date: IsoDate) {
  const day = new Date(toUtcMidnight(date));
  return `${shortMonthFormatter.format(day).toUpperCase()} ${day.getUTCDate()}`;
}
