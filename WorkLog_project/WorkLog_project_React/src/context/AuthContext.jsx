// AuthContext.jsx
import React, { createContext, useState, useEffect } from "react";

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
          "http://localhost:8081/api/usr/member/session",
          {
            method: "get",
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          console.log("세션 조회:", data);
          setIsLoginedId(data);  // 로그인 안 되어 있으면 0 같은 값 오겠지
        }
      } catch (err) {
        console.error("세션 조회 실패:", err);
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
