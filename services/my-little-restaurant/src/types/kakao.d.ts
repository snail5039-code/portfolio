export {};

declare global {
  interface KakaoLatLng {
    getLat(): number;
    getLng(): number;
  }

  interface KakaoMapInstance {
    setCenter(latlng: KakaoLatLng): void;
  }

  interface KakaoMarker {
    setPosition(latlng: KakaoLatLng): void;
    setMap(map: KakaoMapInstance | null): void;
  }

  interface KakaoInfoWindow {
    open(map: KakaoMapInstance, marker: KakaoMarker): void;
    close(): void;
  }

  interface KakaoGeocoderResult {
    x: string;
    y: string;
  }

  interface KakaoCoord2AddressResult {
    address?: {
      region_1depth_name: string;
      region_2depth_name: string;
      region_3depth_name: string;
    };
  }

  interface KakaoGeocoder {
    addressSearch(
      address: string,
      callback: (result: KakaoGeocoderResult[], status: string) => void
    ): void;
    coord2Address(
      lng: number,
      lat: number,
      callback: (result: KakaoCoord2AddressResult[], status: string) => void
    ): void;
  }

  interface KakaoMouseEvent {
    latLng: KakaoLatLng;
  }

  interface KakaoSize {
    width: number;
    height: number;
  }

  interface KakaoMarkerImage {
    __brand: "KakaoMarkerImage";
  }

  interface KakaoMapsSDK {
    load(callback: () => void): void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Size: new (width: number, height: number) => KakaoSize;
    MarkerImage: new (
      src: string,
      size: KakaoSize,
      options?: Record<string, unknown>
    ) => KakaoMarkerImage;
    Map: new (
      container: HTMLElement,
      options: { center: KakaoLatLng; level: number }
    ) => KakaoMapInstance;
    Marker: new (options: {
      position: KakaoLatLng;
      map?: KakaoMapInstance;
      image?: KakaoMarkerImage;
      zIndex?: number;
    }) => KakaoMarker;
    InfoWindow: new (options: {
      content: string | HTMLElement;
    }) => KakaoInfoWindow;
    event: {
      addListener(
        target: KakaoMarker | KakaoMapInstance,
        type: string,
        handler: (event: KakaoMouseEvent) => void
      ): void;
    };
    services: {
      Geocoder: new () => KakaoGeocoder;
      Status: { OK: string };
    };
  }

  interface Window {
    kakao?: {
      maps: KakaoMapsSDK;
    };
  }
}
