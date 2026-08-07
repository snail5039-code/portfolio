"use client";

import { useEffect, useRef } from "react";
import { loadKakaoMaps } from "@/lib/kakao";

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

export default function CoordPickerMap({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markerRef = useRef<KakaoMarker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // 지도 생성은 한 번만 — value가 바뀔 때마다 새로 만들지 않는다.
  useEffect(() => {
    let cancelled = false;

    loadKakaoMaps().then(() => {
      if (cancelled || !containerRef.current) return;
      const kakao = window.kakao;
      if (!kakao) return;

      const center = new kakao.maps.LatLng(
        value?.lat ?? DEFAULT_CENTER.lat,
        value?.lng ?? DEFAULT_CENTER.lng
      );
      const map = new kakao.maps.Map(containerRef.current, {
        center,
        level: 4,
      });
      mapRef.current = map;

      if (value) {
        markerRef.current = new kakao.maps.Marker({ position: center, map });
      }

      kakao.maps.event.addListener(map, "click", (mouseEvent) => {
        const latlng = mouseEvent.latLng;
        if (markerRef.current) {
          markerRef.current.setPosition(latlng);
        } else {
          markerRef.current = new kakao.maps.Marker({ position: latlng, map });
        }
        onChangeRef.current({ lat: latlng.getLat(), lng: latlng.getLng() });
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 주소 검색으로 좌표가 바뀌면 지도/마커를 그 위치로 옮긴다.
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map || !value) return;

    const latlng = new kakao.maps.LatLng(value.lat, value.lng);
    map.setCenter(latlng);
    if (markerRef.current) {
      markerRef.current.setPosition(latlng);
    } else {
      markerRef.current = new kakao.maps.Marker({ position: latlng, map });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="h-40 w-full rounded-md border border-line"
    />
  );
}
