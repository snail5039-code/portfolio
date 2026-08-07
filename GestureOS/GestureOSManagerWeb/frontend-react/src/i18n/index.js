import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

// ✅ Vite면 import.meta.env.BASE_URL 사용 가능 (CRA면 그냥 "/"로 둬도 됨)
const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "ko",
    supportedLngs: ["ko", "en", "ja"],
    nonExplicitSupportedLngs: true, // ✅ ja-JP 같은 것 허용
    load: "languageOnly",           // ✅ ja-JP -> ja 로 정리
    cleanCode: true,

    // ✅ home 추가(필요한 페이지 ns들 계속 추가하면 됨)
    ns: ["common", "header", "board", "member", "layout", "chat", "home"],
    defaultNS: "common",

    backend: {
      // ✅ "/locales/..." 대신 BASE_URL 기반으로 (서브경로 배포 안전)
      loadPath: `${BASE}locales/{{lng}}/{{ns}}.json`
    },

    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "lng" // 여기 값이 ko/en/ja 중 하나로 저장되어야 함
    },

    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    debug: true
  });

export default i18n;
