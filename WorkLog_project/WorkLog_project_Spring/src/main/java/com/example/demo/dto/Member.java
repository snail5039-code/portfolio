package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Member {

	private int id;
	private String regDate;
	private String updateDate;
	private String loginId;
	// 받기만 하고 내보내지 않는다. @JsonIgnore 를 쓰면 회원가입·로그인 요청의
	// 비밀번호까지 안 읽히므로 WRITE_ONLY 를 쓴다.
	// 예전에는 마이페이지 응답 JSON 에 비밀번호 해시가 그대로 실려 나갔다.
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String loginPw;
	private String name; 
	private String email; 
	private String sex; 
	private String address; 
	
}