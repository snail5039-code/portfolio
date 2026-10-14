/**
 * Display formatting for the numeric API contract.
 *
 * The backend sends raw values: money as integers in the response currency and
 * percentages in percent units (6.65 means 6.65%). Every string a user reads is
 * produced here, so precision and sign rules stay in one place.
 */

const KRW_GROUPING = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export function formatWon(amount: number): string {
  return `${KRW_GROUPING.format(amount)}원`;
}

export function formatSignedWon(amount: number): string {
  const sign = amount < 0 ? "" : "+";
  return `${sign}${KRW_GROUPING.format(amount)}원`;
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number, digits = 2): string {
  const sign = value < 0 ? "" : "+";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatShares(quantity: number): string {
  return `${KRW_GROUPING.format(quantity)}주`;
}

/**
 * The backend emits ISO 8601 strings that already carry the KST offset, so the
 * fields are read from the string itself. Using `Date` here would re-render the
 * timestamp in whatever timezone the viewer's machine happens to use.
 */
const ISO_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

export function formatTimeOfDay(isoString: string): string {
  return ISO_PATTERN.exec(isoString)?.[2] ?? isoString;
}

export function formatDateAndMinutes(isoString: string): string {
  const parts = ISO_PATTERN.exec(isoString);
  return parts ? `${parts[1]} ${parts[2]}` : isoString;
}
