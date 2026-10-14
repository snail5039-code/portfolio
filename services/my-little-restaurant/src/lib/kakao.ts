const SCRIPT_ID = "kakao-maps-sdk";

/*
  지도(Map/Marker)와 주소 검색(services.Geocoder)을 같은 스크립트 태그 하나로
  로드한다. services 라이브러리를 포함해도 기본 지도 기능엔 영향이 없어서,
  용도별로 스크립트를 따로 로드해 중복 등록되는 상황을 피한다.
*/
export function loadKakaoMaps(): Promise<void> {
  return new Promise((resolve) => {
    if (window.kakao?.maps?.services) {
      window.kakao.maps.load(resolve);
      return;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      const appkey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false&libraries=services`;
      script.async = true;
      document.head.appendChild(script);
    }

    if (window.kakao?.maps) {
      window.kakao.maps.load(resolve);
      return;
    }
    script.addEventListener("load", () => window.kakao?.maps.load(resolve));
  });
}
