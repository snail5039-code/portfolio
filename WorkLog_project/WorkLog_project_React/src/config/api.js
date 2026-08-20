// API 서버 주소.
//
// 예전에는 화면 코드 35곳에 http://localhost:8081 이 그대로 박혀 있었다.
// 그대로 빌드해서 올리면 방문자의 브라우저가 "자기 PC" 의 8081 포트로 요청을
// 보내기 때문에, 세션 조회부터 실패하고 사이트 전체가 로그인 화면으로 튕겼다.
//
// 개발 중에는 .env 없이도 그냥 되도록 기본값을 남겨둔다.
// 배포할 때는 VITE_API_BASE_URL 을 실제 백엔드 주소로 넣는다.
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081";
