// src/components/FloatingChatBot.jsx
import React, { useContext, useState } from "react";
import { useLocation } from "react-router-dom";
import SiteChatBot from "./SiteChatBot";
import { AuthContext } from "../context/AuthContext";

function FloatingChatBot() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { isLoginedId } = useContext(AuthContext);

  // 소개 페이지에서는 숨기고, 로그인한 사용자의 홈에서는 업무 보조로 제공한다.
  if ((pathname === "/" && isLoginedId === 0) || pathname === "/preview" || pathname === "/developer") return null;

  return (
    <div
      style={{
        position: "fixed",   // ✅ 화면에 고정
        bottom: "20px",      // ✅ 아래에서 20px
        right: "20px",       // ✅ 오른쪽에서 20px
        zIndex: 1000,        // ✅ 다른 요소들 위로
      }}
    >
      {/* 챗봇 창 */}
      {open && (
        <div
          style={{
            marginBottom: "8px",
          boxShadow: "0 12px 36px rgba(72,48,34,0.18)",
          }}
        >
          <SiteChatBot />
        </div>
      )}

      {/* 토글 버튼 (열기/닫기) */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "none",
          backgroundColor: "#d95d3b",
          color: "#fff",
          fontSize: "24px",
          cursor: "pointer",
          boxShadow: "0 10px 24px rgba(217,93,59,0.28)",
        }}
        title="사이트 챗봇"
      >
        💬
      </button>
    </div>
  );
}

export default FloatingChatBot;
