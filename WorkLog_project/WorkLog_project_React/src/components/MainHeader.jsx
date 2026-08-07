// src/components/MainHeader.jsx
import React, { useContext } from 'react';
import { Link, NavLink } from 'react-router-dom';
import LogoutButton from '../pages/Logout';
import { AuthContext } from '../context/AuthContext';

function MainHeader() {
  const { isLoginedId } = useContext(AuthContext); 
  const isLoggedIn = isLoginedId !== 0;

  // 네비게이션 공통 스타일
  const menuLinkClass = ({ isActive }) =>
    [
      "text-lg px-3 py-2 rounded-md transition-colors duration-200",
      // 기본 상태
      !isActive && "text-gray-700 hover:text-teal-600 hover:underline",
      // 선택(활성) 상태
      isActive && "text-teal-600 underline underline-offset-4",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <header className="flex justify-between items-center px-8 py-4 border-b border-gray-200 shadow-md bg-white sticky top-0 z-50">
      
      {/* Logo */}
      <div className="flex items-center">
        <Link to="/" className="text-3xl font-extrabold text-teal-600">
          WorkLog
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex justify-center space-x-2">
        <NavLink to="/" className={menuLinkClass}>
          홈으로
        </NavLink>

        <NavLink to="/about" className={menuLinkClass}>
          WorkLog란?
        </NavLink>

        <NavLink to="/guide" className={menuLinkClass}>
          이용 방법
        </NavLink>

        <NavLink to="/write" className={menuLinkClass}>
          직접 사용하기
        </NavLink>

        <NavLink to="/coming" className={menuLinkClass}>
          부가적인 기능들
        </NavLink>

        <NavLink to="/customerCenter" className={menuLinkClass}>
          고객센터
        </NavLink>
      </nav>

      {/* Auth 버튼 */}
      <div>
        {isLoggedIn ? (
          <div className="flex items-center gap-3">
            <Link
              to="/mypage"
              className="mr-2 text-gray-700 hover:text-teal-600 hover:underline"
            >
              MyPage
            </Link>  
            <LogoutButton /> 
          </div>
        ) : (
          <Link
            to="/login"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md font-medium
                       transition-colors duration-200
                       hover:text-teal-600 hover:border-teal-500"
          >
            로그인/회원가입
          </Link>
        )}
      </div>
    </header>
  );
}

export default MainHeader;
