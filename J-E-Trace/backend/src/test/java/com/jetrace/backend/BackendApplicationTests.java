package com.jetrace.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertFalse;

@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

	@Autowired
	private ApplicationContext applicationContext;

	@Test
	void contextLoads() {
	}

	@Test
	void maintenanceBackfillEndpointIsDisabledByDefault() {
		assertFalse(applicationContext.containsBean("maintenanceController"));
	}

	@Test
	void administratorBootstrapIsDisabledByDefault() {
		assertFalse(applicationContext.containsBean("adminBootstrapInitializer"));
	}

}
