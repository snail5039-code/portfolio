package com.example.demo.interceptor;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

@Component
public class NeedLoginInterceptor implements HandlerInterceptor{
	
	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
			throws Exception {
		// 굳이 없으면 객체 생성 안하려고 하는 것
		HttpSession session = request.getSession(false);
		
		if(session == null || session.getAttribute("logindeMemberId") == null) {
			// 상태 코드를 세우지 않고 false 만 돌려주면 클라이언트는 200 + 빈 본문을 받는다.
			// 그러면 프론트가 "성공했는데 내용이 없다" 로 읽어서 재로그인 유도를 못 한다.
			response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
			response.setContentType("application/json;charset=UTF-8");
			response.getWriter().write("{\"error\":\"로그인이 필요합니다.\"}");
			return false;
		}
		
		return HandlerInterceptor.super.preHandle(request, response, handler);
	}
}
// 혹시 모르니 남겨놓자.