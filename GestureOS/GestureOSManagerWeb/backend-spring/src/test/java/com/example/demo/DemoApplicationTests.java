package com.example.demo;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:gestureos;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
		"spring.datasource.driver-class-name=org.h2.Driver",
		"spring.datasource.username=sa",
		"spring.datasource.password=",
		"spring.sql.init.mode=never",
		"spring.mail.username=test@example.invalid",
		"spring.mail.password=test",
		"spring.security.oauth2.client.registration.google.client-id=test",
		"spring.security.oauth2.client.registration.google.client-secret=test",
		"spring.security.oauth2.client.registration.kakao.client-id=test",
		"spring.security.oauth2.client.registration.kakao.client-secret=test",
		"spring.security.oauth2.client.registration.naver.client-id=test",
		"spring.security.oauth2.client.registration.naver.client-secret=test",
		"app.openai.api-key=test"
})
class DemoApplicationTests {

	@Test
	void contextLoads() {
	}

}
