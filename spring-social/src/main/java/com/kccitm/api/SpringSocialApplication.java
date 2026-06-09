package com.kccitm.api;

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
	
	public static void main(String[] args) {
		SpringApplication.run(SpringSocialApplication.class, args);
	}
}
