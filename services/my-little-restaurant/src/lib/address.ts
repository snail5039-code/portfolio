export function extractDistrict(address: string): string | null {
  // "구/군"(자치구 단위)이 있으면 우선 사용하고, 세종/제주처럼 없는 경우에만 "시" 단위로 대체
  const tokens = address.trim().split(/\s+/);
  return (
    tokens.find((part) => part.length > 1 && /(구|군)$/.test(part)) ??
    tokens.find((part) => part.length > 1 && /시$/.test(part)) ??
    null
  );
}
