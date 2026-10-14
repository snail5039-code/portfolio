import React, { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../config/api";
import { HomeLogo } from "../components/home/HomeBrand";

function DeveloperMode() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const enter = async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/dev/session`, { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "백엔드 개발자 모드가 비활성화되어 있습니다.");
      sessionStorage.setItem("worklog:developer-mode", "true");
      window.location.assign("/");
    } catch (err) {
      setStatus("error");
      setError(err.message || "개발자 모드에 진입할 수 없습니다.");
    }
  };

  if (!import.meta.env.DEV) {
    return <div className="grid min-h-screen place-items-center bg-[#fdfcf9] p-6"><div className="text-center"><h1 className="text-2xl font-bold">개발 환경 전용 화면입니다</h1><Link to="/" className="mt-5 inline-block text-[#d95d3b]">홈으로 돌아가기</Link></div></div>;
  }

  return <div className="min-h-screen bg-[#fdfcf9] px-5 py-8 text-[#1f2e45]">
    <div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><HomeLogo /><Link to="/" className="text-sm text-[#687182]">홈으로</Link></div>
      <main className="mt-16 rounded-[28px] border border-[#eadfd7] bg-white p-8 shadow-[0_20px_60px_rgba(72,48,34,0.08)] md:p-12">
        <span className="rounded-full bg-[#fff0e9] px-3 py-1.5 text-xs font-bold text-[#c84f31]">LOCAL DEVELOPMENT ONLY</span>
        <h1 className="mt-6 font-serif text-4xl font-bold">로그인 없이 전체 기능 확인</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#687182]">설정된 테스트 회원의 백엔드 세션을 발급해 기존 목록, 작성, 보고서, 인수인계, 마이페이지를 실제 화면과 API로 확인합니다.</p>
        <div className="mt-8 rounded-2xl border border-[#f0dfd4] bg-[#fffaf6] p-5 text-sm leading-7 text-[#645d58]"><b className="text-[#26344a]">실행 전 설정</b><br />MySQL을 켜고 백엔드를 <code className="rounded bg-white px-2 py-1">WORKLOG_DEVELOPER_MODE_ENABLED=true</code> 환경변수와 함께 실행하세요. 기본 테스트 회원은 ID 1이며 <code className="rounded bg-white px-2 py-1">WORKLOG_DEVELOPER_MEMBER_ID</code>로 바꿀 수 있습니다. AI 기능까지 확인할 때만 로컬 OpenAI API 키가 필요합니다.</div>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={enter} disabled={status === "loading"} className="mt-7 rounded-xl bg-[#d95d3b] px-6 py-3.5 text-sm font-bold text-white disabled:opacity-50">{status === "loading" ? "세션 연결 중..." : "개발자 모드 시작"}</button>
      </main>
    </div>
  </div>;
}

export default DeveloperMode;
