package com.example.demo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.example.demo.interceptor.NeedLoginInterceptor;
import com.example.demo.interceptor.NeedLogoutInterceptor;

@Configuration
public class WebConfig implements WebMvcConfigurer {
	
	private NeedLoginInterceptor needLoginInterceptor;
	private NeedLogoutInterceptor needLogoutInterceptor;
	
	public WebConfig(NeedLoginInterceptor needLoginInterceptor, NeedLogoutInterceptor needLogoutInterceptor) {
		this.needLoginInterceptor = needLoginInterceptor;
		this.needLogoutInterceptor = needLogoutInterceptor;
	}
	
	
	@Override
	public void addCorsMappings(CorsRegistry registry) {
		// allowedOrigins 는 값을 더하는 게 아니라 통째로 갈아끼운다.
		// 두 번 나눠 부르면 앞의 것이 지워지므로 한 번에 넘긴다.
		registry.addMapping("/api/**").allowCredentials(true)
				.allowedOrigins("http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173");
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		// 각 컨트롤러가 세션을 직접 확인하는 것이 1차 방어이고, 이것은 그 위에 덧대는 그물이다.
		// 경로를 넓게 잡으면 공개여야 할 화면까지 막힐 수 있어, 원래 의도대로 좁게 시작한다.
		registry.addInterceptor(needLoginInterceptor)
				.addPathPatterns("/api/usr/work/workLog", "/api/usr/work/list", "/api/usr/member/logout");

		registry.addInterceptor(needLogoutInterceptor)
				.addPathPatterns("/api/usr/member/login", "/api/usr/member/join");
	}
}
