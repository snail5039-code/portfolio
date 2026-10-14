export type Location = { name: string; latitude: number; longitude: number };

// 전국 대표 지역 좌표 (weather_api.py LOCATIONS와 동일)
export const LOCATIONS: Location[] = [
  { name: "서울", latitude: 37.5665, longitude: 126.978 },
  { name: "부산", latitude: 35.1796, longitude: 129.0756 },
  { name: "대구", latitude: 35.8714, longitude: 128.6014 },
  { name: "인천", latitude: 37.4563, longitude: 126.7052 },
  { name: "광주", latitude: 35.1595, longitude: 126.8526 },
  { name: "대전", latitude: 36.3504, longitude: 127.3845 },
  { name: "울산", latitude: 35.5384, longitude: 129.3114 },
  { name: "세종", latitude: 36.48, longitude: 127.289 },
  { name: "수원", latitude: 37.2636, longitude: 127.0286 },
  { name: "춘천", latitude: 37.8813, longitude: 127.7298 },
  { name: "청주", latitude: 36.6424, longitude: 127.489 },
  { name: "전주", latitude: 35.8242, longitude: 127.148 },
  { name: "목포", latitude: 34.8118, longitude: 126.3922 },
  { name: "안동", latitude: 36.5684, longitude: 128.7294 },
  { name: "창원", latitude: 35.2285, longitude: 128.6811 },
  { name: "제주", latitude: 33.4996, longitude: 126.5312 },
];

export function findLocation(name: string): Location {
  const location = LOCATIONS.find((item) => item.name === name);
  if (!location) throw new Error(`알 수 없는 지역입니다: ${name}`);
  return location;
}
