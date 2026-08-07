"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { searchModelRestaurantsByRegion } from "@/lib/modelRestaurant";
import { loadKakaoMaps } from "@/lib/kakao";
import type { CertifiedMapMarker } from "./KakaoMap";

const GEOCODE_CONCURRENCY = 8;

// Geocoder.addressSearch를 한 번에 다 쏘면 일부가 조용히 실패해서 지도에 덜 찍히는
// 경우가 있어, 동시에 GEOCODE_CONCURRENCY개씩만 돌린다.
async function geocodeWithLimit<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    const current = cursor++;
    if (current >= items.length) return;
    results[current] = await worker(items[current]);
    await runNext();
  }

  await Promise.all(
    Array.from({ length: Math.min(GEOCODE_CONCURRENCY, items.length) }, runNext)
  );
  return results;
}

export default function NearbyModelRestaurantSearch({
  onResults,
}: {
  onResults: (markers: CertifiedMapMarker[]) => void;
}) {
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [hasResults, setHasResults] = useState(false);
  const [detecting, setDetecting] = useState(
    () => typeof navigator !== "undefined" && !!navigator.geolocation
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = async (regionValue: string) => {
    const trimmed = regionValue.trim();
    if (!trimmed) return;

    inputRef.current?.blur();
    setLoading(true);
    setStatus(null);

    try {
      const { items, totalCount, usedKeyword } =
        await searchModelRestaurantsByRegion(trimmed);

      if (items.length === 0) {
        setHasResults(false);
        onResults([]);
        setStatus(`'${usedKeyword}' 검색 결과가 없어요.`);
        return;
      }

      await loadKakaoMaps();
      const kakao = window.kakao;
      if (!kakao) {
        setStatus("카카오맵을 불러오지 못했어요.");
        return;
      }
      const geocoder = new kakao.maps.services.Geocoder();

      const geocoded = await geocodeWithLimit(
        items,
        (item) =>
          new Promise<CertifiedMapMarker | null>((resolve) => {
            geocoder.addressSearch(item.address, (geoResult, geoStatus) => {
              if (geoStatus === kakao.maps.services.Status.OK && geoResult[0]) {
                resolve({
                  id: `${item.name}-${item.address}`,
                  name: item.name,
                  address: item.address,
                  foodType: item.foodType,
                  lat: Number(geoResult[0].y),
                  lng: Number(geoResult[0].x),
                });
              } else {
                resolve(null);
              }
            });
          })
      );

      const markers = geocoded.filter((m): m is CertifiedMapMarker => m !== null);
      setHasResults(markers.length > 0);
      onResults(markers);
      setStatus(
        totalCount > items.length
          ? `'${usedKeyword}' 총 ${totalCount}곳 중 ${markers.length}곳을 지도에 표시했어요.`
          : `'${usedKeyword}' ${markers.length}곳을 지도에 표시했어요.`
      );
    } catch {
      setStatus("검색 중 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  // 마운트 시 내 현재 위치를 구/군 단위로 역지오코딩해서, 검색 없이도
  // 우리 동네 모범업소를 자동으로 지도에 띄운다.
  useEffect(() => {
    if (!navigator.geolocation) return;
    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;

        loadKakaoMaps().then(() => {
          if (cancelled) return;
          const kakao = window.kakao;
          if (!kakao) {
            setDetecting(false);
            return;
          }

          const geocoder = new kakao.maps.services.Geocoder();
          geocoder.coord2Address(
            position.coords.longitude,
            position.coords.latitude,
            (result, geoStatus) => {
              setDetecting(false);
              if (cancelled) return;
              if (geoStatus !== kakao.maps.services.Status.OK || !result[0]) {
                return;
              }
              const district =
                result[0].address?.region_2depth_name ||
                result[0].address?.region_1depth_name;
              if (!district) return;

              setRegion(district);
              runSearch(district);
            }
          );
        });
      },
      () => {
        // 위치 권한 거부/실패 시 자동 표시 없이 수동 검색만 가능
        setDetecting(false);
      },
      // GPS 정확도(enableHighAccuracy)까지는 필요 없고, 실내·PC에서도 빠르게
      // 응답받을 수 있는 네트워크 기반 위치로 충분하다. 타임아웃도 넉넉히 둔다.
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = () => {
    setRegion("");
    setStatus(null);
    setHasResults(false);
    onResults([]);
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-muted px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(region)}
          placeholder="구/군/시 이름 한 단어로 검색 (예: 강남구, 수원시)"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
        <button
          onClick={() => runSearch(region)}
          disabled={loading || !region.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          우리 동네 모범업소 찾기
        </button>
        {hasResults && (
          <button
            onClick={handleClear}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
            지우기
          </button>
        )}
      </div>
      {status && <p className="pl-6 text-[11px] text-muted">{status}</p>}
      {detecting && !status && (
        <p className="pl-6 text-[11px] text-muted">
          내 위치를 확인해서 우리 동네 모범업소를 찾는 중...
        </p>
      )}
    </div>
  );
}
