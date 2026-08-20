// AuthContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { API_BASE } from "../config/api";

export const AuthContext = createContext({
  isLoginedId: 0,
  authLoaded: false,
  setIsLoginedId: () => {},
});

export function AuthProvider({ children }) {
  const [isLoginedId, setIsLoginedId] = useState(0);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const viewSession = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/usr/member/session`,
          {
            method: "get",
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          // 앱 전역의 가드가 isLoginedId === 0 으로 판단하기 때문에
          // 숫자가 아닌 값(null, {})이 들어오면 null !== 0 이 참이 되어
          // 비로그인인데 로그인으로 오해한다. 숫자만 받아들인다.
          setIsLoginedId(Number.isInteger(data) && data > 0 ? data : 0);
        } else {
          // 500·401 을 "비로그인"과 뭉뚱그리지 않는다.
          console.error("세션 조회 실패:", res.status);
          setIsLoginedId(0);
        }
      } catch (err) {
        console.error("세션 조회 실패:", err);
        setIsLoginedId(0);
      } finally {
        // ✅ 무조건 로딩 끝났다고 표시
        setAuthLoaded(true);
      }
    };

    viewSession();
  }, []);

  const contextValue = {
    isLoginedId,
    setIsLoginedId,
    authLoaded,          // ✅ 여기 꼭 넣어줘야 함
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
