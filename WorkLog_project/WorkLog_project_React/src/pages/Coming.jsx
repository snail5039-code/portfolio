// src/pages/ComingSoon.jsx
import React from "react";
import Comingsoon from "../assets/Comingsoon.png";

function Coming() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          borderRadius: "24px",
          padding: "32px 28px 28px",
          backgroundColor: "#ffffff",
          boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
        }}
      >
        {/* ✅ 이미지 들어갈 큰 영역 (여기다가 img 넣으면 됨) */}
        <div
          style={{
            width: "100%",
            height: "350px",
            borderRadius: "18px",
            border: "1px dashed #e5e5e5",
            backgroundColor: "#fafafa",
            overflow: "hidden",
            marginBottom: "28px",
          }}
        >
          {/* 나중에 이렇게 이미지 넣어 쓰면 됨 */}
        
          <img
            src= {Comingsoon}
            alt="준비 중인 페이지"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
      
        </div>

        {/* 텍스트 영역 */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              marginBottom: "10px",
              fontSize: "28px",
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
            }}
          >
            아쉽지만, 페이지 준비중입니다.
          </h1>
          <p
            style={{
              margin: 0,
              color: "#6b7280",
              fontSize: "14px",
              lineHeight: 1.7,
              wordBreak: "keep-all",
            }}
          >
            더 나은 서비스를 위해 해당 페이지를 열심히 준비하고 있어요.
            <br />
            조금만 기다려주시면 멋진 모습으로 찾아올게요.
            <br />
            유감
          </p>
        </div>
      </div>
    </div>
  );
}

export default Coming;
