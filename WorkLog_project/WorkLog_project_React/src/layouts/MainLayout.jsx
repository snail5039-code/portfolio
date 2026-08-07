import React, { useContext, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import LogoutButton from "../pages/Logout";
import { AuthContext } from "../context/AuthContext";
import MainHeader from "../components/MainHeader";

// ✅ 아코디언 섹션 컴포넌트 (1차 메뉴용)
// label: "업무 관련" 같은 제목
// isOpen: 열려있는지 여부
// onToggle: 클릭 시 열고 닫는 함수
// children: 안쪽의 실제 메뉴 링크들
function AccordionSection({ label, isOpen, onToggle, children }) {
  return (
    <div className="mb-3">
      {/* 1차 메뉴 버튼 역할 */}
      <button
        type="button"
        onClick={onToggle}
        className="
          w-full flex items-center justify-between
          text-sm font-semibold text-gray-700
          px-3 py-2
          rounded-lg
          bg-gray-50
          hover:bg-teal-50
          transition-colors duration-200
          shadow-sm
        "
      >
        <span>{label}</span>
        {/* 화살표 아이콘 회전 애니메이션 */}
        <span
          className={`
            text-xs
            transform
            transition-transform
            duration-200
            ${isOpen ? "rotate-90" : "rotate-0"}
          `}
        >
          ▶
        </span>
      </button>

      {/* 3차 메뉴 영역: 부드럽게 펼쳐지도록 max-height + opacity 애니메이션 */}
      <div
        className={`
          overflow-hidden
          transition-all
          duration-300
          ${isOpen ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"}
        `}
      >
        <nav className="space-y-1 text-sm pl-2 pt-1">{children}</nav>
      </div>
    </div>
  );
}

function MainLayout() {
  const { isLoginedId } = useContext(AuthContext);
  const isLogined = isLoginedId !== 0;

  // ✅ 1차 메뉴(업무 관련 / 인수인계 관련 / 그 외 게시판) 접었다 펼치는 상태
  const [openMenus, setOpenMenus] = useState({
    work: true, // 업무 관련
    handover: true, // 인수인계 관련
    etc: true, // 그 외 게시판
  });

  // ✅ 클릭하면 true/false 토글
  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 ">
      <MainHeader /> {/* ✅ 여기서도 같은 헤더 사용 */}
      {/* 아래 영역: 왼쪽 2/3차 메뉴 + 오른쪽 실제 페이지 내용 */}
      <div className="flex">
        {/* 왼쪽 사이드 메뉴 박스 - 폭 넓게 + 살짝 카드 느낌 */}
        <aside
          className="
            w-80              /* 기존보다 넓게: w-64 → w-80 */
            bg-white
            border-r border-gray-300
            min-h-[calc(100vh-64px)]
            p-4
            shadow-md
          "
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" }} // 검은 테두리 느낌
        >
          <div className="mb-4 text-base font-bold text-gray-800">메뉴</div>
          <AccordionSection
            label="게시판"
            isOpen={openMenus.work}
            onToggle={() => toggleMenu("work")}
          >
            <Link
              to="/write"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              게시물 작성
            </Link>
            <Link
              to="/list"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              게시물 목록
            </Link>
          </AccordionSection>
          {/* 2차/3차 메뉴: 아코디언 형태 */}

          {/* 업무 관련 */}
          <AccordionSection
            label="업무일지"
            isOpen={openMenus.work}
            onToggle={() => toggleMenu("work")}
          >
            <Link
              to="/weeklyWrite"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              주간업무일지 작성
            </Link>

            <Link
              to="/MonthlyWrite"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              월간업무일지 작성
            </Link>

            <Link
              to="/list?boardId=4"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              일일업무일지
            </Link>

            <Link
              to="/list?boardId=5"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              주간업무일지
            </Link>

            <Link
              to="/list?boardId=6"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              월간업무일지
            </Link>
          </AccordionSection>

          {/* 인수인계 관련 */}
          <AccordionSection
            label="인수인계"
            isOpen={openMenus.handover}
            onToggle={() => toggleMenu("handover")}
          >
            <Link
              to="/handoverWrite"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              인수인계 작성
            </Link>
            <Link
              to="/handoverList"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              인수인계 목록
            </Link>
          </AccordionSection>

          {/* 그 외 게시판 */}
          <AccordionSection
            label="그 외 게시판"
            isOpen={openMenus.etc}
            onToggle={() => toggleMenu("etc")}
          >
            <Link
              to="/list?boardId=1"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              공지사항
            </Link>
            <Link
              to="/list?boardId=2"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              자유게시판
            </Link>
            <Link
              to="/list?boardId=3"
              className="block px-3 py-2 rounded-md hover:bg-gray-100"
            >
              질문과 답변
            </Link>
          </AccordionSection>
        </aside>

        {/* 오른쪽: 각 페이지별로 다른 모습으로 나오는 메인 영역 */}
        <main className="flex-1 p-8">
          {/* 여기 안에 List, Write, Detail 같은 실제 페이지 컴포넌트가 들어옴 */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
