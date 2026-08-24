package com.example.demo;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"spring.ai.openai.api-key=test-key",
		"spring.mail.host=localhost"
})
class WorkLogProjectApplicationTests {

	@Test
	void contextLoads() {
	}

}
