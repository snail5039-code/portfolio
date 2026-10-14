import React, { useContext } from "react";
import { Link, NavLink } from "react-router-dom";
import LogoutButton from "../pages/Logout";
import { AuthContext } from "../context/AuthContext";
import { HomeLogo } from "./home/HomeBrand";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

const navItems = [["/", "홈"], ["/write", "업무 기록"], ["/weeklyWrite", "주간 보고"], ["/monthlyWrite", "월간 보고"], ["/handoverList", "인수인계"], ["/list?boardId=4", "기록함"]];

function MainHeader() {
  const { isLoginedId } = useContext(AuthContext);
  const isLoggedIn = isLoginedId !== 0;
  const menuClass = ({ isActive }) => `whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-[#fff0e9] text-[#c84f31]" : "text-[#596274] hover:bg-[#fff7f2] hover:text-[#c84f31]"}`;
  return (
    <>{sessionStorage.getItem("worklog:developer-mode") === "true" && <div className="bg-[#24334a] px-4 py-2 text-center text-xs font-semibold text-white">개발자 모드 · 테스트 회원 데이터 사용 중</div>}<header className="sticky top-0 z-50 border-b border-[#eadfd7] bg-[#fdfcf9]/95 backdrop-blur">
      <div className="mx-auto flex min-h-[68px] max-w-[1600px] items-center gap-5 px-4 md:px-7">
        <div className="shrink-0"><HomeLogo /></div>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
          {navItems.map(([to, label]) => <NavLink key={to} to={to} className={menuClass}>{label}</NavLink>)}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isLoggedIn ? <><WorkspaceSwitcher /><Link to="/mypage" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#364154] hover:bg-[#fff0e9] sm:block">내 설정</Link><LogoutButton /></> : <Link to="/login" className="rounded-full border border-[#dfcfc4] bg-white px-4 py-2 text-sm font-bold text-[#26344a] hover:border-[#d95d3b] hover:text-[#c84f31]">로그인 / 회원가입</Link>}
        </div>
      </div>
    </header></>
  );
}
export default MainHeader;
