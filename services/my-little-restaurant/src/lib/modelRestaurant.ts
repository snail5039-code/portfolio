"use server";

import { extractDistrict } from "./address";

// 행정안전부_모범음식점정보 조회서비스 (data.go.kr, 15155052)
// Base URL: apis.data.go.kr/1741000/excellent_restaurant_info
// 제공 필드: 업소명/주소/전화번호/음식유형/지정일자 등 — 메뉴 정보는 제공하지 않음.
const BASE_URL =
  "https://apis.data.go.kr/1741000/excellent_restaurant_info/info";

type ModelRestaurantItem = {
  BSNSSP_NM: string; // 업소명
  ROAD_NM_ADDR: string; // 도로명주소
  LCTN_ADDR: string; // 소재지주소
  SALS_STTS_NM: string; // 영업상태명
  DSGN_YMD: string; // 지정일자
  DSGN_RTRCN_YMD: string; // 지정취소일자
  FD_OF_TYPE: string; // 음식의유형
  PRINC_FD_KND: string; // 주된음식종류
};

export type ModelRestaurantMatch = {
  name: string;
  designatedAt: string;
  foodType: string;
};

export async function checkModelRestaurant(
  name: string,
  address?: string | null
): Promise<ModelRestaurantMatch | null> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey || !name.trim()) return null;

  const params = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: "10",
    returnType: "JSON",
    "cond[BSNSSP_NM::LIKE]": name.trim(),
  });

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      next: { revalidate: 60 * 60 * 24 }, // 하루 1회 정도만 갱신
    });
    if (!res.ok) return null;

    const data = await res.json();
    // 정상 응답 코드는 "0"/"00" 등으로 실제 응답마다 다르게 내려옴 — 실패 코드(음수)만 걸러낸다.
    const resultCode = data?.response?.header?.resultCode;
    if (resultCode === undefined || String(resultCode).startsWith("-")) {
      return null;
    }

    const rawItems = data?.response?.body?.items?.item;
    const items: ModelRestaurantItem[] = Array.isArray(rawItems)
      ? rawItems
      : rawItems
        ? [rawItems]
        : [];

    const district = address ? extractDistrict(address) : null;

    const match = items.find((item) => {
      const stillDesignated =
        item.SALS_STTS_NM?.includes("영업") && !item.DSGN_RTRCN_YMD;
      if (!stillDesignated) return false;
      if (!district) return true;
      return (
        item.LCTN_ADDR?.includes(district) ||
        item.ROAD_NM_ADDR?.includes(district)
      );
    });

    if (!match) return null;

    return {
      name: match.BSNSSP_NM,
      designatedAt: match.DSGN_YMD,
      foodType: match.FD_OF_TYPE || match.PRINC_FD_KND || "",
    };
  } catch {
    return null;
  }
}

export type ModelRestaurantSearchItem = {
  name: string;
  address: string;
  foodType: string;
};

export type ModelRestaurantSearchResult = {
  items: ModelRestaurantSearchItem[];
  totalCount: number;
  usedKeyword: string;
};

const MAX_REGION_RESULTS = 100; // API가 허용하는 한 페이지 최대 건수

export async function searchModelRestaurantsByRegion(
  regionInput: string
): Promise<ModelRestaurantSearchResult> {
  // 이 API의 cond[...::LIKE] 검색어는 공백이 들어가면 매칭이 전부 0건이 되는 걸
  // 실제 호출로 확인함 — "서울특별시 강남구"는 0건, "강남구"만 넣으면 정상 매칭.
  // 그래서 사용자가 여러 단어를 입력해도 첫 단어만 검색어로 쓴다.
  const region = regionInput.trim().split(/\s+/)[0] ?? "";
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey || !region) {
    return { items: [], totalCount: 0, usedKeyword: region };
  }

  const params = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: String(MAX_REGION_RESULTS),
    returnType: "JSON",
    "cond[ROAD_NM_ADDR::LIKE]": region,
  });

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return { items: [], totalCount: 0, usedKeyword: region };

    const data = await res.json();
    const resultCode = data?.response?.header?.resultCode;
    if (resultCode === undefined || String(resultCode).startsWith("-")) {
      return { items: [], totalCount: 0, usedKeyword: region };
    }

    const rawItems = data?.response?.body?.items?.item;
    const items: ModelRestaurantItem[] = Array.isArray(rawItems)
      ? rawItems
      : rawItems
        ? [rawItems]
        : [];

    const active = items
      .filter(
        (item) => item.SALS_STTS_NM?.includes("영업") && !item.DSGN_RTRCN_YMD
      )
      .map((item) => ({
        name: item.BSNSSP_NM,
        address: item.ROAD_NM_ADDR || item.LCTN_ADDR,
        foodType: item.FD_OF_TYPE || item.PRINC_FD_KND || "",
      }));

    return {
      items: active,
      totalCount: Number(data?.response?.body?.totalCount ?? active.length),
      usedKeyword: region,
    };
  } catch {
    return { items: [], totalCount: 0, usedKeyword: region };
  }
}
