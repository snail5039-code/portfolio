import axios from "axios";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseUrl = configuredApiBaseUrl || (import.meta.env.DEV ? "http://localhost:8080" : "");

const api = axios.create({
  baseURL: apiBaseUrl || undefined,
  withCredentials: true,
});

if (!apiBaseUrl) {
  api.interceptors.request.use(() =>
    Promise.reject(
      new Error(
        "API 서버 주소가 설정되지 않았습니다. VITE_API_BASE_URL 환경변수를 설정해 주세요."
      )
    )
  );
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status === 401 &&
      typeof window !== "undefined" &&
      localStorage.getItem("previewMode") !== "true"
    ) {
      [
        "loginId",
        "loginName",
        "loginRole",
        "className",
        "approved",
        "subject",
        "managedClasses",
      ].forEach((key) => localStorage.removeItem(key));

      if (!window.location.pathname.startsWith("/auth")) {
        const mode = window.location.pathname.startsWith("/teacher")
          ? "TEACHER"
          : window.location.pathname.startsWith("/admin")
            ? "ADMIN"
            : "STUDENT";
        window.location.replace(`/auth?mode=${mode}&reason=session-expired`);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

