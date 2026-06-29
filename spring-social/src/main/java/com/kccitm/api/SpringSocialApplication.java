package com.kccitm.api;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;

import com.kccitm.api.config.AppProperties;

// NOTE: @EnableScheduling moved to SchedulingConfig (gated @Profile("!report-worker"))
// so the report-worker container does NOT re-run the platform's @Scheduled jobs.
@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
@EnableAsync
@EnableCaching
public class SpringSocialApplication {

	static {
		// Force the whole JVM to UTC so SimpleDateFormat (which otherwise uses the
		// server's local timezone) agrees with Jackson (@JsonFormat defaults to UTC)
		// and the JDBC connection (serverTimezone=UTC). Without this, a DOB typed at
		// registration was parsed in the server's local TZ and stored shifted, while
		// login parsed the same string in UTC — so username+DOB never matched and
		// students got "Invalid credentials". Set in a static block so it applies
		// before any bean, formatter, or DB connection is created.
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
	}

	
	public static void main(String[] args) {
		SpringApplication.run(SpringSocialApplication.class, args);
	}
}
