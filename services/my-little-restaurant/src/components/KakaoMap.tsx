"use client";

import { useEffect, useRef } from "react";
import { loadKakaoMaps } from "@/lib/kakao";

export type MapMarker = {
  id: number | string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  memo?: string | null;
};

export type CertifiedMapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  foodType?: string;
};

const CERTIFIED_MARKER_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 21 15 21s15-10 15-21C30 6.7 23.3 0 15 0z" fill="#059669"/>
      <circle cx="15" cy="14" r="7.5" fill="#fff"/>
      <path d="M11 14.3l2.6 2.6 5.4-5.4" stroke="#059669" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  );

const CURRENT_LOCATION_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="10" fill="#2563eb" fill-opacity="0.22"/>
      <circle cx="11" cy="11" r="6" fill="#2563eb" stroke="#fff" stroke-width="2.5"/>
    </svg>`
  );

const INFO_WINDOW_WIDTH = 200;

// 인포윈도우 상자 비율이 내용 길이에 따라 들쭥날쭥해지지 않도록, 줄바꿈 대신
// 한 줄로 자르고 ...으로 표시한다.
function applySingleLineEllipsis(el: HTMLElement) {
  el.style.width = "100%";
  el.style.whiteSpace = "nowrap";
  el.style.overflow = "hidden";
  el.style.textOverflow = "ellipsis";
}

export default function KakaoMap({
  markers,
  certifiedMarkers = [],
  onRegisterCertified,
}: {
  markers: MapMarker[];
  certifiedMarkers?: CertifiedMapMarker[];
  onRegisterCertified?: (marker: CertifiedMapMarker) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const onRegisterCertifiedRef = useRef(onRegisterCertified);
  useEffect(() => {
    onRegisterCertifiedRef.current = onRegisterCertified;
  }, [onRegisterCertified]);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      const kakao = window.kakao;
      if (!kakao) return;

      const centerSource = certifiedMarkers[0] ?? markers[0];
      const center = centerSource
        ? new kakao.maps.LatLng(centerSource.lat, centerSource.lng)
        : new kakao.maps.LatLng(37.5665, 126.978);

      const map = new kakao.maps.Map(mapRef.current, {
        center,
        level: 6,
      });

      // 마커를 클릭하면 다른 인포윈도우는 닫고, 이미 열려 있는 마커를 다시
      // 클릭하면 닫히도록 현재 열린 인포윈도우 하나만 추적한다.
      let openInfoWindow: KakaoInfoWindow | null = null;
      const toggleInfoWindow = (infowindow: KakaoInfoWindow, marker: KakaoMarker) => {
        if (openInfoWindow === infowindow) {
          infowindow.close();
          openInfoWindow = null;
          return;
        }
        openInfoWindow?.close();
        infowindow.open(map, marker);
        openInfoWindow = infowindow;
      };

      markers.forEach((marker) => {
        const position = new kakao.maps.LatLng(marker.lat, marker.lng);
        // 모범업소 마커(zIndex 1)와 겹칠 때 내 맛집 마커가 가려지지 않도록 위에 그린다
        const kakaoMarker = new kakao.maps.Marker({ position, map, zIndex: 3 });

        // 일정한 비율로 보이도록 고정 폭 카드 형태로 구성한다.
        const content = document.createElement("div");
        content.style.padding = "10px 12px";
        content.style.fontSize = "13px";
        content.style.width = `${INFO_WINDOW_WIDTH}px`;

        const nameEl = document.createElement("strong");
        nameEl.style.display = "block";
        applySingleLineEllipsis(nameEl);
        nameEl.textContent = marker.name;
        nameEl.title = marker.name;
        content.appendChild(nameEl);

        if (marker.category) {
          const categoryEl = document.createElement("span");
          categoryEl.style.display = "inline-block";
          categoryEl.style.marginTop = "3px";
          categoryEl.style.padding = "1px 6px";
          categoryEl.style.borderRadius = "9999px";
          categoryEl.style.background = "#d24d1719";
          categoryEl.style.color = "#d24d17";
          categoryEl.style.fontSize = "10px";
          categoryEl.style.fontWeight = "600";
          categoryEl.textContent = marker.category;
          content.appendChild(categoryEl);
        }

        if (marker.memo) {
          const memoEl = document.createElement("p");
          memoEl.style.margin = "4px 0 0";
          memoEl.style.fontSize = "12px";
          memoEl.style.color = "#78716c";
          applySingleLineEllipsis(memoEl);
          memoEl.textContent = marker.memo;
          memoEl.title = marker.memo;
          content.appendChild(memoEl);
        }

        const linkEl = document.createElement("a");
        linkEl.href = `/restaurants/${marker.id}`;
        linkEl.textContent = "상세보기 →";
        linkEl.style.display = "inline-block";
        linkEl.style.marginTop = "6px";
        linkEl.style.fontSize = "12px";
        linkEl.style.fontWeight = "600";
        linkEl.style.color = "#d24d17";
        linkEl.style.textDecoration = "underline";
        content.appendChild(linkEl);

        const infowindow = new kakao.maps.InfoWindow({ content });

        kakao.maps.event.addListener(kakaoMarker, "click", () => {
          toggleInfoWindow(infowindow, kakaoMarker);
        });
      });

      const markerImage = new kakao.maps.MarkerImage(
        CERTIFIED_MARKER_IMAGE,
        new kakao.maps.Size(30, 36)
      );

      certifiedMarkers.forEach((marker) => {
        const position = new kakao.maps.LatLng(marker.lat, marker.lng);
        const kakaoMarker = new kakao.maps.Marker({
          position,
          map,
          image: markerImage,
          zIndex: 1,
        });

        // 등록 버튼은 실제 클릭 핸들러가 필요해서 문자열 대신 DOM 엘리먼트로
        // 인포윈도우 내용을 구성한다 (문자열 content엔 이벤트를 못 붙인다).
        const content = document.createElement("div");
        content.style.padding = "10px 12px";
        content.style.fontSize = "13px";
        content.style.width = `${INFO_WINDOW_WIDTH}px`;

        const nameEl = document.createElement("strong");
        nameEl.style.display = "block";
        applySingleLineEllipsis(nameEl);
        nameEl.textContent = marker.name;
        nameEl.title = marker.name;
        content.appendChild(nameEl);

        const badgeEl = document.createElement("span");
        badgeEl.style.display = "inline-block";
        badgeEl.style.marginTop = "3px";
        badgeEl.style.padding = "1px 6px";
        badgeEl.style.borderRadius = "9999px";
        badgeEl.style.background = "#05966922";
        badgeEl.style.color = "#059669";
        badgeEl.style.fontSize = "10px";
        badgeEl.style.fontWeight = "600";
        badgeEl.textContent = "모범음식점";
        content.appendChild(badgeEl);

        if (marker.foodType) {
          const foodTypeEl = document.createElement("p");
          foodTypeEl.style.margin = "4px 0 0";
          foodTypeEl.style.fontSize = "12px";
          foodTypeEl.style.color = "#059669";
          foodTypeEl.style.fontWeight = "600";
          applySingleLineEllipsis(foodTypeEl);
          foodTypeEl.textContent = marker.foodType;
          content.appendChild(foodTypeEl);
        }

        if (marker.address) {
          const addressEl = document.createElement("p");
          addressEl.style.margin = "4px 0 0";
          addressEl.style.fontSize = "12px";
          addressEl.style.color = "#78716c";
          applySingleLineEllipsis(addressEl);
          addressEl.textContent = marker.address;
          addressEl.title = marker.address;
          content.appendChild(addressEl);
        }

        if (onRegisterCertifiedRef.current) {
          const registerBtn = document.createElement("button");
          registerBtn.type = "button";
          registerBtn.textContent = "내 리스트에 등록하기 →";
          registerBtn.style.display = "inline-block";
          registerBtn.style.marginTop = "6px";
          registerBtn.style.fontSize = "12px";
          registerBtn.style.fontWeight = "600";
          registerBtn.style.color = "#d24d17";
          registerBtn.style.background = "none";
          registerBtn.style.border = "none";
          registerBtn.style.padding = "0";
          registerBtn.style.cursor = "pointer";
          registerBtn.style.textDecoration = "underline";
          registerBtn.addEventListener("click", () => {
            onRegisterCertifiedRef.current?.(marker);
            infowindow.close();
            if (openInfoWindow === infowindow) openInfoWindow = null;
          });
          content.appendChild(registerBtn);
        }

        const infowindow = new kakao.maps.InfoWindow({ content });

        kakao.maps.event.addListener(kakaoMarker, "click", () => {
          toggleInfoWindow(infowindow, kakaoMarker);
        });
      });

      // 검색된 모범업소가 없을 때(기본 지도 보기)만 실제 내 위치로 중심을 옮긴다.
      // 지역 검색 결과가 있으면 그 지역을 계속 보여줘야 하므로 내 위치로 되돌아가지 않는다.
      if (certifiedMarkers.length === 0 && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled) return;
            const myLatLng = new kakao.maps.LatLng(
              position.coords.latitude,
              position.coords.longitude
            );
            map.setCenter(myLatLng);
            new kakao.maps.Marker({
              position: myLatLng,
              map,
              image: new kakao.maps.MarkerImage(
                CURRENT_LOCATION_IMAGE,
                new kakao.maps.Size(22, 22)
              ),
              zIndex: 10,
            });
          },
          () => {
            // 위치 권한 거부/실패 시 기존 중심(내 맛집·검색 결과 또는 서울시청) 유지
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [markers, certifiedMarkers]);

  return <div ref={mapRef} className="h-[420px] w-full sm:h-[540px]" />;
}
